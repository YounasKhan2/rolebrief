import { useEffect, useState } from "react";
import { Download, Trash2, Bell, Mail, Shield, Accessibility, Ban } from "lucide-react";
import { PageContainer, PageHeader } from "../../components/shell/AppShell";
import { Button, SectionRule } from "../../components/ui/primitives";
import { Switch, SegmentedControl, Select } from "../../components/ui/form";
import { Dialog } from "../../components/ui/overlay";
import { useToast } from "../../components/ui/toast";
import { useAuth } from "../../lib/auth";
import * as authApi from "../../lib/auth-api";
import type { AuthSession } from "../../lib/auth-api";

function Row({ title, description, control }: { title: string; description?: string; control: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-6 py-4">
      <div className="min-w-0">
        <p className="text-sm font-medium text-ink">{title}</p>
        {description && <p className="text-[13px] text-slate mt-0.5">{description}</p>}
      </div>
      <div className="shrink-0">{control}</div>
    </div>
  );
}

function SettingsCard({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-[var(--radius-card)] border border-line p-5">
      <div className="flex items-center gap-2 mb-1">
        <span className="text-indigo">{icon}</span>
        <h2 className="text-base font-semibold text-ink">{title}</h2>
      </div>
      <div className="divide-y divide-line">{children}</div>
    </section>
  );
}

export function Component() {
  const toast = useToast();
  const { user, logout } = useAuth();
  const [sessions, setSessions] = useState<AuthSession[]>([]);
  const [jobAlerts, setJobAlerts] = useState(true);
  const [marketing, setMarketing] = useState(false);
  const [productEmails, setProductEmails] = useState(true);
  const [quietHours, setQuietHours] = useState(true);
  const [emailFreq, setEmailFreq] = useState("Daily");
  const [reducedMotion, setReducedMotion] = useState(false);
  const [highContrast, setHighContrast] = useState(false);
  const [privateProfile, setPrivateProfile] = useState(true);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    void authApi.sessions().then((result) => setSessions(result.sessions)).catch(() => setSessions([]));
  }, []);

  return (
    <PageContainer className="max-w-[820px]">
      <PageHeader kicker="Settings" title="Control how RoleBrief works for you." description="Notifications, privacy, accessibility and your data — all in one place." />

      <div className="space-y-5">
        <SettingsCard icon={<Bell size={18} />} title="Notifications">
          <Switch label="Job alerts" description="Fresh matches from your saved alerts — the core of RoleBrief." checked={jobAlerts} onChange={setJobAlerts} />
          <Switch label="Product updates by email" description="Occasional notes about new features." checked={productEmails} onChange={setProductEmails} />
          <Switch label="Marketing & promotions" description="Separate from job alerts — turning this off never affects your alerts." checked={marketing} onChange={setMarketing} />
        </SettingsCard>

        <SettingsCard icon={<Mail size={18} />} title="Email frequency & quiet hours">
          <Row title="Digest frequency" control={<SegmentedControl size="sm" value={emailFreq} onChange={setEmailFreq} options={["Instant", "Daily", "Weekly"].map((v) => ({ value: v, label: v }))} />} />
          <Switch label="Quiet hours (10pm–8am)" description="Hold notifications overnight; delivered next morning." checked={quietHours} onChange={setQuietHours} />
        </SettingsCard>

        <SettingsCard icon={<Shield size={18} />} title="Privacy">
          <Row title="Signed in as" description={user?.email ?? "Current account"} control={<Button variant="secondary" size="sm" onClick={() => void logout()}>Log out</Button>} />
          <Row title="Active sessions" description={`${sessions.length} active ${sessions.length === 1 ? "session" : "sessions"}`} control={<Button variant="tertiary" size="sm" onClick={() => void authApi.logoutAll().then(() => logout())}>Log out all devices</Button>} />
          <Switch label="Private profile" description="Your profile powers matching only. It's private in the MVP." checked={privateProfile} onChange={setPrivateProfile} />
          <Row title="Search & activity history" description="Used to improve your Match Briefs." control={<Button variant="tertiary" size="sm" onClick={() => toast({ kind: "success", message: "Activity history cleared." })}>Clear history</Button>} />
        </SettingsCard>

        <SettingsCard icon={<Accessibility size={18} />} title="Accessibility">
          <Switch label="Reduce motion" description="Minimise animations and transitions across the app." checked={reducedMotion} onChange={setReducedMotion} />
          <Switch label="Increase contrast" description="Stronger borders and text contrast." checked={highContrast} onChange={setHighContrast} />
          <Row title="Interface language" control={
            <Select aria-label="Interface language" defaultValue="en" className="w-44">
              <option value="en">English</option>
              <option value="ur">اردو (Urdu)</option>
            </Select>
          } />
        </SettingsCard>

        <SettingsCard icon={<Ban size={18} />} title="Muted & blocked">
          <Row title="Hidden companies" description="No hidden companies are stored yet." control={<Button variant="tertiary" size="sm">Manage</Button>} />
          <Row title="Blocked sources" description="No blocked sources are stored yet." control={<Button variant="tertiary" size="sm">Manage</Button>} />
        </SettingsCard>

        <SectionRule className="my-2" />

        <SettingsCard icon={<Download size={18} />} title="Your data">
          <Row title="Export your data" description="Download a copy of your profile, saved items and activity (JSON)." control={<Button variant="secondary" size="sm" icon={<Download size={14} />} onClick={() => toast({ kind: "info", message: "Preparing your export — we'll email a link." })}>Export</Button>} />
          <Row title="Delete account" description="Permanently remove your account, résumé and all data." control={<Button variant="destructive" size="sm" icon={<Trash2 size={14} />} onClick={() => setConfirmDelete(true)}>Delete</Button>} />
        </SettingsCard>
      </div>

      <Dialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title="Delete your account?"
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirmDelete(false)}>Keep account</Button>
            <Button variant="destructive" onClick={() => { setConfirmDelete(false); toast({ kind: "warning", message: "Account scheduled for deletion." }); }}>Delete everything</Button>
          </>
        }
      >
        <p className="text-slate">This removes your profile, résumé, saved briefs, alerts and tracker. It can't be undone. Any active alerts stop immediately.</p>
      </Dialog>
    </PageContainer>
  );
}
