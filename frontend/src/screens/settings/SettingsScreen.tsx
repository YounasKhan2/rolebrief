import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router";
import {
  Bell,
  Mail,
  Shield,
  Accessibility,
  Key,
  Laptop,
  Smartphone,
  CheckCircle2,
  AlertTriangle,
  Globe,
  Lock,
  ExternalLink
} from "lucide-react";
import { PageContainer, PageHeader } from "../../shared/shell/AppShell";
import "../../shared/candidate/candidate-account.css";
import { Badge, Button, SectionRule } from "../../ui/primitives";
import { Switch, SegmentedControl, Input } from "../../ui/form";
import { useToast } from "../../ui/toast";
import { relativeTime } from "../../lib/core/format";
import { useAuth } from "../../lib/auth/auth";
import * as authApi from "../../lib/auth/auth-api";
import type { AuthSession } from "../../lib/auth/auth-api";
import * as preferencesApi from "../../lib/features/preferences-api";
import type { UserPreferences } from "../../lib/features/preferences-api";
import {
  applyThemePreferences,
  getCachedThemePreferences,
  subscribeToAccessibilityChanges,
  MotionPreference,
  ContrastPreference
} from "../../lib/accessibility/accessibility";

function Row({
  title,
  description,
  control
}: {
  title: string;
  description?: string;
  control: React.ReactNode;
}) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 py-4">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-ink">{title}</p>
        {description && <p className="text-[13px] text-slate mt-0.5 leading-relaxed">{description}</p>}
      </div>
      <div className="shrink-0">{control}</div>
    </div>
  );
}

function SettingsCard({
  id,
  icon,
  title,
  children
}: {
  id?: string;
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="candidate-settings-section">
      <div className="flex items-center gap-2 mb-1">
        <span className="text-indigo">{icon}</span>
        <h2 tabIndex={-1} className="text-base font-semibold text-ink outline-none">
          {title}
        </h2>
      </div>
      <div className="divide-y divide-line">{children}</div>
    </section>
  );
}

export function SettingsScreen() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const toast = useToast();

  const [prefs, setPrefs] = useState<UserPreferences | null>(null);
  const [loadingPrefs, setLoadingPrefs] = useState(true);
  const [mutatingField, setMutatingField] = useState<string | null>(null);

  // Active Sessions
  const [activeSessions, setActiveSessions] = useState<AuthSession[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(false);
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [revokingOthers, setRevokingOthers] = useState(false);

  // Password Form State
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  // Load preferences from backend
  const fetchPreferences = async () => {
    try {
      const res = await preferencesApi.getPreferences();
      setPrefs(res.preferences);
      // Synchronize client-side cached theme
      applyThemePreferences(
        res.preferences.motionPreference,
        res.preferences.contrastPreference,
        false
      );
    } catch {
      toast({
        kind: "error",
        message: "Failed to load preferences. Using standard defaults."
      });
    } finally {
      setLoadingPrefs(false);
    }
  };

  const fetchSessions = async () => {
    setLoadingSessions(true);
    try {
      const res = await authApi.sessions();
      setActiveSessions(res.sessions || []);
    } catch {
      // Session fetch error handled gracefully
    } finally {
      setLoadingSessions(false);
    }
  };

  useEffect(() => {
    fetchPreferences();
    fetchSessions();
  }, []);

  // Deep-link / Focus handling for /app/settings/notifications
  useEffect(() => {
    if (
      location.pathname.includes("/settings/notifications") ||
      location.hash === "#notifications"
    ) {
      const el = document.getElementById("notification-preferences");
      if (el) {
        el.scrollIntoView({ behavior: "smooth" });
        const heading = el.querySelector("h2");
        heading?.focus();
      }
    }
  }, [location.pathname, location.hash]);

  // Subscribe to OS accessibility preference changes and cross-tab broadcasts
  useEffect(() => {
    const cleanup = subscribeToAccessibilityChanges(
      () => ({
        motion: prefs?.motionPreference ?? "SYSTEM",
        contrast: prefs?.contrastPreference ?? "SYSTEM"
      }),
      (external) => {
        if (prefs) {
          setPrefs((prev) =>
            prev
              ? {
                  ...prev,
                  motionPreference: external.motion,
                  contrastPreference: external.contrast
                }
              : prev
          );
        }
      }
    );
    return cleanup;
  }, [prefs?.motionPreference, prefs?.contrastPreference]);

  // Atomic Preferences Mutation with 409 Concurrency Recovery
  const handleUpdate = async (
    updates: Partial<Omit<UserPreferences, "revision" | "isPersisted" | "updatedAt">>,
    fieldKey: string
  ) => {
    if (!prefs) return;
    const previous = { ...prefs };
    const optimistic: UserPreferences = {
      ...prefs,
      ...updates
    };
    setPrefs(optimistic);
    setMutatingField(fieldKey);

    // Apply accessibility changes immediately if updated
    if (updates.motionPreference || updates.contrastPreference) {
      applyThemePreferences(
        updates.motionPreference ?? prefs.motionPreference,
        updates.contrastPreference ?? prefs.contrastPreference,
        true
      );
    }

    try {
      const res = await preferencesApi.updatePreferences({
        ...updates,
        expectedRevision: prefs.revision
      });
      setPrefs(res.preferences);
      toast({
        kind: "success",
        message: "Preferences updated."
      });
    } catch (err: any) {
      if (err?.status === 409 || err?.statusCode === 409) {
        toast({
          kind: "warning",
          message: "Preferences were modified in another session. Refreshed with latest."
        });
        await fetchPreferences();
      } else if (err?.status === 429 || err?.statusCode === 429) {
        setPrefs(previous);
        toast({
          kind: "error",
          message: "Too many requests. Please wait before updating preferences again."
        });
      } else {
        setPrefs(previous);
        toast({
          kind: "error",
          message: err?.message || "Failed to save preferences."
        });
      }
    } finally {
      setMutatingField(null);
    }
  };

  // Revoke a single remote session family
  const handleRevokeSession = async (sessionId: string) => {
    setRevokingId(sessionId);
    try {
      const res = await authApi.revokeSession(sessionId);
      if (res?.isCurrentRevoked) {
        toast({
          kind: "info",
          message: "Current session revoked. Logging out..."
        });
        navigate("/auth/login");
        return;
      }
      toast({
        kind: "success",
        message: "Session revoked successfully."
      });
      await fetchSessions();
    } catch (err: any) {
      toast({
        kind: "error",
        message: err?.message || "Failed to revoke session."
      });
    } finally {
      setRevokingId(null);
    }
  };

  // Revoke all other session families preserving current
  const handleRevokeOthers = async () => {
    setRevokingOthers(true);
    try {
      const res = await authApi.revokeOtherSessions();
      toast({
        kind: "success",
        message: res.message || "All other sessions signed out."
      });
      await fetchSessions();
    } catch (err: any) {
      toast({
        kind: "error",
        message: err?.message || "Failed to revoke other sessions."
      });
    } finally {
      setRevokingOthers(false);
    }
  };

  // Change Password
  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError(null);

    if (!currentPassword) {
      setPasswordError("Current password is required.");
      return;
    }
    if (newPassword.length < 12) {
      setPasswordError("New password must be at least 12 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError("New passwords do not match.");
      return;
    }

    setChangingPassword(true);
    try {
      await authApi.changePassword(currentPassword, newPassword);
      toast({
        kind: "success",
        message: "Password changed. All other sessions have been signed out."
      });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setShowPasswordForm(false);
      await fetchSessions();
    } catch (err: any) {
      setPasswordError(err?.message || "Failed to update password.");
    } finally {
      setChangingPassword(false);
    }
  };

  return (
    <PageContainer className="candidate-account candidate-settings">
      <PageHeader
        title="Settings"
        description="Manage preferences, sessions, security, and accessibility."
      />

      <div className="space-y-6">
        {/* 1. Notification Preferences */}
        <SettingsCard
          id="notification-preferences"
          icon={<Bell size={18} />}
          title="Notification Preferences"
        >
          <Row
            title="Product updates"
            description="Receive occasional updates about new features and improvements to RoleBrief."
            control={
              <Switch
                aria-label="Product updates"
                checked={prefs?.productUpdates ?? false}
                disabled={loadingPrefs || mutatingField === "productUpdates"}
                aria-busy={mutatingField === "productUpdates"}
                onChange={(checked) => handleUpdate({ productUpdates: checked }, "productUpdates")}
              />
            }
          />

          <Row
            title="Marketing & announcements"
            description="Receive news, research insights, and job-search tips."
            control={
              <Switch
                aria-label="Marketing emails"
                checked={prefs?.marketingEmails ?? false}
                disabled={loadingPrefs || mutatingField === "marketingEmails"}
                aria-busy={mutatingField === "marketingEmails"}
                onChange={(checked) =>
                  handleUpdate({ marketingEmails: checked }, "marketingEmails")
                }
              />
            }
          />

          {/* Honest unbuilt state: Job alerts */}
          <Row
            title="Job alerts"
            description="Real-time notifications matching your active job-search criteria."
            control={
              <span className="inline-flex items-center px-2.5 py-1 rounded text-xs font-medium bg-canvas text-slate border border-line">
                Available when Alerts launches
              </span>
            }
          />

          {/* Honest unbuilt state: Digest & Quiet Hours */}
          <Row
            title="Digest cadence & quiet hours"
            description="Scheduled bundling and silent hours for non-urgent notifications."
            control={
              <span className="inline-flex items-center px-2.5 py-1 rounded text-xs font-medium bg-canvas text-slate border border-line">
                Scheduled delivery engine in development
              </span>
            }
          />

          {/* Mandatory security notices */}
          <div className="py-3 px-3.5 my-2 rounded-[var(--radius-control)] bg-canvas border border-line flex items-start gap-2.5 text-xs text-slate">
            <Lock size={14} className="text-slate shrink-0 mt-0.5" />
            <p>
              <strong className="text-ink font-medium">Mandatory security notices:</strong> Critical security alerts,
              session notifications, and password change verifications are always delivered to your verified email address.
            </p>
          </div>
        </SettingsCard>

        {/* 2. Account & Security */}
        <SettingsCard id="account-security" icon={<Shield size={18} />} title="Account & Security">
          <Row
            title="Signed in as"
            description={user?.email}
            control={
              <div className="flex items-center gap-2">
                <Badge variant={user?.isAdmin ? "brand" : "neutral"}>
                  {user?.isAdmin ? "Admin" : "Member"}
                </Badge>
                {user?.isAdmin && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => navigate("/app/admin")}
                    className="text-xs flex items-center gap-1 text-indigo"
                  >
                    Admin Console <ExternalLink size={12} />
                  </Button>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={async () => {
                    await logout();
                    navigate("/auth/login");
                  }}
                >
                  Log out
                </Button>
              </div>
            }
          />

          {/* Password Management */}
          <div className="py-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-ink">Password</p>
                <p className="text-[13px] text-slate mt-0.5">
                  Ensure your account uses a secure password of at least 12 characters.
                </p>
              </div>
              <Button
                variant={showPasswordForm ? "ghost" : "outline"}
                size="sm"
                onClick={() => {
                  setShowPasswordForm(!showPasswordForm);
                  setPasswordError(null);
                }}
              >
                {showPasswordForm ? "Cancel" : "Change password"}
              </Button>
            </div>

            {showPasswordForm && (
              <form
                onSubmit={handleChangePassword}
                className="mt-4 p-4 rounded-[var(--radius-control)] bg-canvas border border-line space-y-3 max-w-md"
              >
                {passwordError && (
                  <div className="p-2.5 rounded bg-amber-500/10 border border-amber-500/30 text-amber-600 text-xs flex items-center gap-2">
                    <AlertTriangle size={14} className="shrink-0" />
                    <span>{passwordError}</span>
                  </div>
                )}
                <div>
                  <label className="text-xs font-medium text-slate block mb-1">
                    Current Password
                  </label>
                  <Input
                    type="password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="Enter current password"
                    autoComplete="current-password"
                    required
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate block mb-1">
                    New Password (min 12 characters)
                  </label>
                  <Input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Enter new secure password"
                    autoComplete="new-password"
                    required
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate block mb-1">
                    Confirm New Password
                  </label>
                  <Input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Confirm new password"
                    autoComplete="new-password"
                    required
                  />
                </div>
                <div className="pt-1 flex items-center justify-between">
                  <span className="text-[11px] text-slate">
                    Other sessions will be signed out.
                  </span>
                  <Button type="submit" size="sm" disabled={changingPassword}>
                    {changingPassword ? "Updating..." : "Update Password"}
                  </Button>
                </div>
              </form>
            )}
          </div>

          {/* Active Sessions List */}
          <div className="py-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
              <div>
                <p className="text-sm font-medium text-ink">Active session devices</p>
                <p className="text-[13px] text-slate mt-0.5">
                  Devices with active access credentials to your account.
                </p>
              </div>
              {activeSessions.filter((s) => !s.isCurrent).length > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleRevokeOthers}
                  disabled={revokingOthers}
                  className="text-amber-600 border-amber-600/30 hover:bg-amber-600/10 text-xs"
                >
                  {revokingOthers ? "Signing out..." : "Log out other devices"}
                </Button>
              )}
            </div>

            {loadingSessions ? (
              <p className="text-xs text-slate py-2">Loading active sessions...</p>
            ) : activeSessions.length === 0 ? (
              <p className="text-xs text-slate py-2">No active sessions found.</p>
            ) : (
              <div className="space-y-2.5 mt-2">
                {activeSessions.map((session) => (
                  <div
                    key={session.id}
                    className="p-3 rounded-[var(--radius-control)] border border-line bg-canvas flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                  >
                    <div className="flex items-start gap-3 min-w-0">
                      <span className="text-slate shrink-0 mt-0.5">
                        {session.device?.isMobile ? (
                          <Smartphone size={16} />
                        ) : (
                          <Laptop size={16} />
                        )}
                      </span>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-ink">
                            {session.device?.browser || "Browser"} on {session.device?.os || "Device"}
                          </span>
                          {session.isCurrent && (
                            <Badge variant="brand">Current session</Badge>
                          )}
                        </div>
                        <div className="text-slate mt-0.5 flex items-center gap-2 flex-wrap">
                          {session.ipAddress && <span>IP: {session.ipAddress}</span>}
                          <span>Signed in {relativeTime(session.createdAt)}</span>
                          {session.lastActiveAt && (
                            <span>• Active {relativeTime(session.lastActiveAt)}</span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="shrink-0 flex items-center gap-2">
                      {!session.isCurrent && (
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={revokingId === session.id}
                          onClick={() => handleRevokeSession(session.id)}
                          className="text-xs text-slate hover:text-ink"
                        >
                          {revokingId === session.id ? "Revoking..." : "Revoke"}
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </SettingsCard>

        {/* 3. Accessibility */}
        <SettingsCard id="accessibility-preferences" icon={<Accessibility size={18} />} title="Accessibility">
          <Row
            title="Reduced motion"
            description="Control animation behavior. System follows your operating system preference."
            control={
              <SegmentedControl
                value={
                  prefs?.motionPreference === "REDUCE"
                    ? "Reduce"
                    : prefs?.motionPreference === "NO_PREFERENCE"
                    ? "Standard"
                    : "System"
                }
                onChange={(val) => {
                  const motionPref: MotionPreference =
                    val === "Reduce" ? "REDUCE" : val === "Standard" ? "NO_PREFERENCE" : "SYSTEM";
                  handleUpdate({ motionPreference: motionPref }, "motionPreference");
                }}
                options={[
                  { value: "System", label: "System" },
                  { value: "Reduce", label: "Reduce" },
                  { value: "Standard", label: "Standard" }
                ]}
              />
            }
          />

          <Row
            title="High contrast"
            description="Enhance visual contrast and border emphasis for improved readability."
            control={
              <SegmentedControl
                value={
                  prefs?.contrastPreference === "HIGH"
                    ? "High"
                    : prefs?.contrastPreference === "NORMAL"
                    ? "Standard"
                    : "System"
                }
                onChange={(val) => {
                  const contrastPref: ContrastPreference =
                    val === "High" ? "HIGH" : val === "Standard" ? "NORMAL" : "SYSTEM";
                  handleUpdate({ contrastPreference: contrastPref }, "contrastPreference");
                }}
                options={[
                  { value: "System", label: "System" },
                  { value: "High", label: "High" },
                  { value: "Standard", label: "Standard" }
                ]}
              />
            }
          />
        </SettingsCard>

        {/* 4. Preferences & Localization */}
        <SettingsCard id="localization-preferences" icon={<Globe size={18} />} title="Preferences & Localization">
          <Row
            title="Interface language"
            description="Primary display language for RoleBrief interface controls and navigation."
            control={
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-ink bg-canvas px-3 py-1.5 rounded border border-line">
                  English (US)
                </span>
                <span className="text-[11px] text-slate">Supported</span>
              </div>
            }
          />

          <Row
            title="Timezone"
            description="Used for deadline calculations, job freshness timestamps, and reminder schedules."
            control={
              <span className="text-xs text-ink font-medium bg-canvas px-3 py-1.5 rounded border border-line">
                {prefs?.timezone || "UTC"}
              </span>
            }
          />
        </SettingsCard>

        {/* 5. Privacy & Data Lifecycle */}
        <SettingsCard id="privacy-preferences" icon={<Lock size={18} />} title="Privacy & Data Lifecycle">
          <Row
            title="Public candidate profile"
            description="Control external discovery and recruiter access to your candidate profile."
            control={
              <span className="inline-flex items-center px-2.5 py-1 rounded text-xs font-medium bg-canvas text-slate border border-line">
                RoleBrief profiles are currently private
              </span>
            }
          />

          <Row
            title="Data export & account deletion"
            description="Download structured account records or permanently delete account data."
            control={
              <span className="inline-flex items-center px-2.5 py-1 rounded text-xs font-medium bg-canvas text-slate border border-line">
                Account lifecycle tools are not available yet
              </span>
            }
          />
        </SettingsCard>
      </div>
    </PageContainer>
  );
}

export { SettingsScreen as Component };
export default SettingsScreen;
