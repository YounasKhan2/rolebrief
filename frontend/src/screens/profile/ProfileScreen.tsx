import { useEffect, useRef, useState, useCallback } from "react";
import { useNavigate } from "react-router";
import {
  FileText,
  Pencil,
  ShieldCheck,
  Lock,
  RefreshCw,
  Loader2,
  X,
  Plus,
  Check,
  AlertTriangle
} from "lucide-react";
import { PageContainer, PageHeader } from "../../components/shell/AppShell";
import "../../components/candidate/candidate-account.css";
import { Kicker, Badge, Button, SectionRule, FilterChip } from "../../components/ui/primitives";
import { Input } from "../../components/ui/form";
import { useAuth } from "../../lib/auth";
import { ApiError } from "../../lib/api";
import {
  COMMON_COUNTRIES,
  CURATED_DISCIPLINES,
  EMPLOYMENT_TYPE_OPTIONS,
  RELOCATION_OPTIONS,
  REMOTE_OPTIONS,
  SEARCH_STATUS_OPTIONS,
  SENIORITY_OPTIONS,
  SPONSORSHIP_OPTIONS
} from "../../lib/taxonomies";
import {
  getProfile,
  updateProfile,
  getOnboardingState,
  completeOnboarding,
  CandidateSearchStatus,
  CandidateSkillItem,
  EmploymentType,
  ProfileState,
  RelocationPreference,
  RemotePreference,
  SalaryPeriod,
  SeniorityLevel
} from "../../lib/onboarding-api";

export function Component() {
  const navigate = useNavigate();
  const { user, isAdmin, updateOnboardingStatus } = useAuth();

  // Admin redirect
  useEffect(() => {
    if (isAdmin) {
      navigate("/admin", { replace: true });
    }
  }, [isAdmin, navigate]);

  const [profileData, setProfileData] = useState<ProfileState | null>(null);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isCompleting, setIsCompleting] = useState(false);

  // Concurrency tracking
  const [profileRevision, setProfileRevision] = useState(0);
  const [conflictError, setConflictError] = useState<string | null>(null);
  const [conflictServerState, setConflictServerState] = useState<ProfileState | null>(null);

  // Edit form state
  const [targetRoles, setTargetRoles] = useState<string[]>([]);
  const [newRoleInput, setNewRoleInput] = useState("");
  const [targetDisciplines, setTargetDisciplines] = useState<string[]>([]);
  const [seniority, setSeniority] = useState<SeniorityLevel | null>(null);
  const [searchStatus, setSearchStatus] = useState<CandidateSearchStatus | null>(null);
  const [headline, setHeadline] = useState("");
  const [bio, setBio] = useState("");
  const [expYears, setExpYears] = useState<number | null>(null);
  const [currentCountry, setCurrentCountry] = useState("");
  const [currentCity, setCurrentCity] = useState("");
  const [timezone, setTimezone] = useState("");
  const [remotePref, setRemotePref] = useState<RemotePreference | null>(null);
  const [visaNeeded, setVisaNeeded] = useState<boolean | null>(null);
  const [workAuths, setWorkAuths] = useState<string[]>([]);
  const [preferredCountries, setPreferredCountries] = useState<string[]>([]);
  const [employmentTypes, setEmploymentTypes] = useState<EmploymentType[]>([]);
  const [relocationPref, setRelocationPref] = useState<RelocationPreference | null>(null);
  const [skills, setSkills] = useState<CandidateSkillItem[]>([]);
  const [newSkillInput, setNewSkillInput] = useState("");
  const [minSalary, setMinSalary] = useState<number | undefined>(undefined);
  const [maxSalary, setMaxSalary] = useState<number | undefined>(undefined);
  const [salaryCurrency, setSalaryCurrency] = useState<string | null>(null);
  const [salaryPeriod, setSalaryPeriod] = useState<SalaryPeriod | null>(null);

  const modalRef = useRef<HTMLDivElement>(null);
  const initialFocusRef = useRef<HTMLInputElement>(null);

  const populateEditForm = useCallback((data: ProfileState) => {
    setProfileRevision(data.profileRevision ?? data.profile?.revision ?? 0);
    if (data.preferences?.targetRoleTitles) setTargetRoles(data.preferences.targetRoleTitles);
    else setTargetRoles([]);
    if (data.preferences?.targetDisciplines) setTargetDisciplines(data.preferences.targetDisciplines);
    else setTargetDisciplines([]);
    setSeniority(data.profile?.seniorityLevel ?? null);
    setSearchStatus(data.profile?.searchStatus ?? null);
    setHeadline(data.profile?.headline ?? "");
    setBio(data.profile?.bio ?? "");
    setExpYears(data.profile?.experienceYears ?? null);
    setCurrentCountry(data.profile?.currentCountry ?? "");
    setCurrentCity(data.profile?.currentCity ?? "");
    setTimezone(data.profile?.timezone ?? data.user?.timezone ?? "");
    setRemotePref(data.preferences?.remotePreference ?? null);
    setVisaNeeded(data.profile?.requiresVisaSponsorship ?? null);
    setWorkAuths(data.profile?.workAuthorizations ?? []);
    setPreferredCountries(data.preferences?.preferredCountries ?? []);
    setEmploymentTypes(data.preferences?.employmentTypes ?? []);
    setRelocationPref(data.preferences?.relocationPreference ?? null);
    setSkills(data.skills ?? []);
    setMinSalary(data.preferences?.minSalary ?? undefined);
    setMaxSalary(data.preferences?.maxSalary ?? undefined);
    setSalaryCurrency(data.preferences?.salaryCurrency ?? null);
    setSalaryPeriod(data.preferences?.salaryPeriod ?? null);
  }, []);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const res = await getProfile();
      setProfileData(res);
      populateEditForm(res);
    } catch {
      // Direct load error
    } finally {
      setLoading(false);
    }
  }, [populateEditForm]);

  useEffect(() => {
    if (!isAdmin) {
      void load();
    }
  }, [isAdmin, load]);

  // Accessible Escape key and focus management for the modal
  useEffect(() => {
    if (!isEditing) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsEditing(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    const scrollPrev = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    // Set initial focus
    setTimeout(() => {
      initialFocusRef.current?.focus();
    }, 50);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = scrollPrev;
    };
  }, [isEditing]);

  function toggleArrayItem(list: string[], item: string, setter: (items: string[]) => void) {
    if (list.includes(item)) {
      setter(list.filter((x) => x !== item));
    } else {
      setter([...list, item]);
    }
  }

  function handleAddSkill() {
    const cleaned = newSkillInput.trim().replace(/\s+/g, " ").normalize("NFKC");
    if (!cleaned) return;
    const exists = skills.some(
      (s) => s.displayName.toLowerCase() === cleaned.toLowerCase()
    );
    if (!exists && skills.length < 50) {
      setSkills([...skills, { displayName: cleaned, source: "USER_DECLARED" }]);
      setNewSkillInput("");
    }
  }

  function handleResolveConflict() {
    if (conflictServerState) {
      setProfileData(conflictServerState);
      populateEditForm(conflictServerState);
      setConflictError(null);
      setConflictServerState(null);
    } else {
      void load().then(() => {
        setConflictError(null);
        setConflictServerState(null);
      });
    }
  }

  async function handleSaveBrief(e: React.FormEvent) {
    e.preventDefault();
    setIsSaving(true);
    setSaveError(null);
    setConflictError(null);

    try {
      const updated = await updateProfile({
        expectedRevision: profileRevision,
        profile: {
          headline: headline.trim() || undefined,
          bio: bio.trim() || undefined,
          experienceYears: expYears ?? undefined,
          seniorityLevel: seniority || undefined,
          currentCountry: currentCountry || undefined,
          currentCity: currentCity.trim() || undefined,
          timezone: timezone.trim() || undefined,
          workAuthorizations: workAuths,
          requiresVisaSponsorship: visaNeeded ?? undefined,
          searchStatus: searchStatus || undefined
        },
        preferences: {
          targetRoleTitles: targetRoles,
          targetDisciplines,
          remotePreference: remotePref || undefined,
          preferredCountries,
          employmentTypes,
          relocationPreference: relocationPref || undefined,
          minSalary: minSalary || undefined,
          maxSalary: maxSalary || undefined,
          salaryCurrency: salaryCurrency || undefined,
          salaryPeriod: salaryPeriod || undefined
        },
        skills
      });

      setProfileData(updated);
      populateEditForm(updated);
      setIsSaving(false);
      setSaveSuccess(true);
      setTimeout(() => {
        setSaveSuccess(false);
        setIsEditing(false);
      }, 700);
    } catch (err: unknown) {
      setIsSaving(false);
      if (err instanceof ApiError && err.status === 409) {
        setConflictServerState(err.payload?.currentState ?? null);
        setConflictError("Profile was updated in another session. Reconcile with latest changes before saving.");
      } else {
        setSaveError(err instanceof Error ? err.message : "Failed to update profile brief.");
      }
    }
  }

  async function handleCompleteBrief() {
    setIsCompleting(true);
    setSaveError(null);
    try {
      const onboardingState = await getOnboardingState();
      const currentRev = onboardingState.progress?.revision ?? 0;

      const updated = await updateProfile({
        expectedRevision: profileRevision,
        profile: {
          headline: headline.trim() || undefined,
          bio: bio.trim() || undefined,
          experienceYears: expYears ?? undefined,
          seniorityLevel: seniority || undefined,
          currentCountry: currentCountry || undefined,
          currentCity: currentCity.trim() || undefined,
          timezone: timezone.trim() || undefined,
          workAuthorizations: workAuths,
          requiresVisaSponsorship: visaNeeded ?? undefined,
          searchStatus: searchStatus || undefined
        },
        preferences: {
          targetRoleTitles: targetRoles,
          targetDisciplines,
          remotePreference: remotePref || undefined,
          preferredCountries,
          employmentTypes,
          relocationPreference: relocationPref || undefined,
          minSalary: minSalary || undefined,
          maxSalary: maxSalary || undefined,
          salaryCurrency: salaryCurrency || undefined,
          salaryPeriod: salaryPeriod || undefined
        },
        skills
      });

      await completeOnboarding({ expectedRevision: currentRev });
      updateOnboardingStatus("COMPLETED");

      setProfileData((prev) => (prev ? { ...prev, ...updated } : null));
      populateEditForm(updated);
      setIsCompleting(false);
      setSaveSuccess(true);
      setTimeout(() => {
        setSaveSuccess(false);
        setIsEditing(false);
      }, 700);
    } catch (err: unknown) {
      setIsCompleting(false);
      setSaveError(err instanceof Error ? err.message : "Failed to complete opportunity brief.");
    }
  }

  if (isAdmin) {
    return null;
  }

  if (loading && !profileData) {
    return (
      <PageContainer className="candidate-account candidate-profile">
        <div className="py-24 flex flex-col items-center justify-center gap-3">
          <Loader2 size={24} className="animate-spin text-indigo" />
          <span className="text-xs font-mono uppercase tracking-widest text-slate">
            Loading profile…
          </span>
        </div>
      </PageContainer>
    );
  }

  const profile = profileData?.profile;
  const preferences = profileData?.preferences;
  const activeSkills = profileData?.skills ?? [];
  const completeness = profileData?.completeness ?? 0;
  const briefCompleteness = profileData?.briefCompleteness ?? 0;
  const isSkipped = user?.onboardingStatus === "SKIPPED";

  // Honest display representations (no false defaults)
  const sponsorshipLabel =
    profile?.requiresVisaSponsorship === true
      ? "Sponsorship required"
      : profile?.requiresVisaSponsorship === false
        ? "No sponsorship required"
        : "Not declared";

  const relocationLabel = preferences?.relocationPreference
    ? preferences.relocationPreference.replace(/_/g, " ").toLowerCase()
    : "Not specified";

  const fields = [
    {
      label: "Target roles",
      value: preferences?.targetRoleTitles?.length
        ? preferences.targetRoleTitles.join(", ")
        : "Not specified"
    },
    {
      label: "Seniority & Experience",
      value: `${profile?.seniorityLevel ? profile.seniorityLevel : "Unspecified"}${
        profile?.experienceYears !== null && profile?.experienceYears !== undefined
          ? ` (${profile.experienceYears} yrs)`
          : ""
      } · ${profile?.searchStatus ? profile.searchStatus.replace(/_/g, " ").toLowerCase() : "Not specified"}`
    },
    {
      label: "Primary disciplines",
      value: preferences?.targetDisciplines?.length
        ? preferences.targetDisciplines.join(", ")
        : "Not specified"
    },
    {
      label: "Professional headline",
      value: profile?.headline || "Not specified"
    },
    {
      label: "Base location & Timezone",
      value: profile?.currentCountry
        ? `${profile.currentCity ? `${profile.currentCity}, ` : ""}${profile.currentCountry}${
            profile.timezone ? ` (${profile.timezone})` : ""
          }`
        : "Not specified"
    },
    {
      label: "Remote preference",
      value: preferences?.remotePreference
        ? preferences.remotePreference.replace(/_/g, " ")
        : "Not specified"
    },
    {
      label: "Work authorizations (No sponsorship needed)",
      value: profile?.workAuthorizations?.length
        ? profile.workAuthorizations.join(", ")
        : "Not specified"
    },
    {
      label: "Visa sponsorship & Relocation",
      value: `${sponsorshipLabel} · Relocation: ${relocationLabel}`
    },
    {
      label: "Preferred target countries",
      value: preferences?.preferredCountries?.length
        ? preferences.preferredCountries.join(", ")
        : "Not specified"
    },
    {
      label: "Employment types",
      value: preferences?.employmentTypes?.length
        ? preferences.employmentTypes.join(", ")
        : "Not specified"
    },
    {
      label: "Verified skills",
      value: activeSkills.length
        ? activeSkills.map((s) => s.displayName).join(", ")
        : "None declared"
    },
    {
      label: "Compensation expectation",
      value: preferences?.minSalary
        ? `${preferences.salaryCurrency ?? "USD"} ${preferences.minSalary.toLocaleString()}${
            preferences.maxSalary ? ` – ${preferences.maxSalary.toLocaleString()}` : "+"
          } (${preferences.salaryPeriod ?? "ANNUAL"})`
        : "Not disclosed"
    }
  ];

  return (
    <PageContainer className="candidate-account candidate-profile">
      <PageHeader
        title="Profile"
        description="The facts RoleBrief uses to personalize your search."
        actions={
          <Button
            variant="secondary"
            onClick={() => setIsEditing(true)}
            icon={<Pencil size={15} />}
          >
            Update opportunity brief
          </Button>
        }
      />

      {/* Skipped Onboarding Banner */}
      {isSkipped && (
        <div className="rounded-[var(--radius-card)] border border-amber/30 bg-amber-light/30 p-4 mb-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <ShieldCheck size={18} className="text-amber shrink-0" />
            <p className="text-xs text-ink leading-relaxed">
              <span className="font-semibold">Opportunity brief is currently skipped.</span> Complete your brief anytime to unlock full Match Brief accuracy and personalized Radar ranking.
            </p>
          </div>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => setIsEditing(true)}
            className="shrink-0"
          >
            Complete brief
          </Button>
        </div>
      )}

      {/* Dual Completeness Dashboard with accessible progressbars */}
      <div className="grid sm:grid-cols-2 gap-4 mb-6">
        <div className="rounded-[var(--radius-card)] border border-line bg-white p-5 shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <Kicker className="font-mono text-xs">Opportunity brief</Kicker>
            <span className="font-data text-sm font-semibold text-ink">{briefCompleteness}%</span>
          </div>
          <div
            className="h-2 rounded-full bg-line/60 overflow-hidden"
            role="progressbar"
            aria-valuenow={briefCompleteness}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`Opportunity brief completeness: ${briefCompleteness}%`}
          >
            <div
              className="h-full bg-indigo transition-all duration-500 rounded-full"
              style={{ width: `${briefCompleteness}%` }}
            />
          </div>
          <p className="text-xs text-slate mt-2">
            Core information required for candidate ranking and Radar feed.
          </p>
        </div>

        <div className="rounded-[var(--radius-card)] border border-line bg-white p-5 shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <Kicker className="font-mono text-xs">Total profile completeness</Kicker>
            <span className="font-data text-sm font-semibold text-ink">{completeness}%</span>
          </div>
          <div
            className="h-2 rounded-full bg-line/60 overflow-hidden"
            role="progressbar"
            aria-valuenow={completeness}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`Total profile completeness: ${completeness}%`}
          >
            <div
              className="h-full bg-emerald transition-all duration-500 rounded-full"
              style={{ width: `${completeness}%` }}
            />
          </div>
          <p className="text-xs text-slate mt-2">
            Includes professional headline, biography, and full career background.
          </p>
        </div>
      </div>

      {/* Biography Card (if declared) */}
      {profile?.bio && (
        <div className="rounded-[var(--radius-card)] border border-line bg-white p-5 mb-4 shadow-xs">
          <Kicker className="text-[11px] font-mono text-slate mb-1">Professional Biography</Kicker>
          <p className="text-sm text-ink leading-relaxed whitespace-pre-wrap">{profile.bio}</p>
        </div>
      )}

      {/* Canonical Attributes Grid */}
      <div className="grid sm:grid-cols-2 gap-4">
        {fields.map((f) => (
          <div
            key={f.label}
            className="rounded-[var(--radius-card)] border border-line bg-white p-5 shadow-xs"
          >
            <Kicker className="text-[11px] font-mono text-slate mb-1">{f.label}</Kicker>
            <p className="text-sm font-medium text-ink break-words">{f.value}</p>
          </div>
        ))}
      </div>

      <SectionRule className="my-8" />

      {/* Résumé Management Staging (Transparent Unavailable State) */}
      <div className="rounded-[var(--radius-feature)] border border-line bg-white p-6 shadow-xs">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-ink font-serif">Résumé & Document Parsing</h2>
          <Badge tone="indigo">
            <ShieldCheck size={12} className="mr-1" /> Private & Verified
          </Badge>
        </div>

        <div className="rounded-[var(--radius-card)] border border-line bg-paper/60 p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="size-10 rounded-full bg-soft border border-line flex items-center justify-center text-slate">
              <FileText size={18} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-ink">Automated Parsing Engine</span>
                <span className="inline-flex items-center gap-1 text-[11px] font-mono px-2 py-0.5 rounded-full bg-slate/10 text-slate font-medium">
                  <Lock size={10} /> Coming Soon
                </span>
              </div>
              <p className="text-xs text-slate mt-1">
                Direct PDF and Word document extraction is scheduled for an upcoming release. Your profile above is active and editable directly.
              </p>
            </div>
          </div>

          <Button
            variant="tertiary"
            size="sm"
            onClick={() => setIsEditing(true)}
            icon={<Pencil size={13} />}
          >
            Edit brief directly
          </Button>
        </div>
      </div>

      {/* Accessible Opportunity Brief Editor Modal */}
      {isEditing && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 overflow-y-auto"
          onClick={(e) => {
            if (e.target === e.currentTarget && !isSaving) {
              setIsEditing(false);
            }
          }}
          role="presentation"
        >
          <div
            ref={modalRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="modal-profile-title"
            className="relative w-full max-w-2xl rounded-[var(--radius-feature)] border border-line bg-white p-6 sm:p-8 shadow-xl my-8 max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between pb-4 border-b border-line mb-6">
              <div>
                <h3 id="modal-profile-title" className="text-lg font-semibold text-ink font-serif">
                  Update Opportunity Brief
                </h3>
                <p className="text-xs text-slate mt-0.5">
                  Edit canonical candidate preferences and career profile.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className="text-slate hover:text-ink transition-colors p-1 rounded-md focus-visible:ring-2 focus-visible:ring-indigo/30"
                aria-label="Close dialog"
              >
                <X size={18} />
              </button>
            </div>

            {/* Concurrency Conflict Warning Banner */}
            {conflictError && (
              <div className="mb-5 rounded-[var(--radius-card)] border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs">
                <div className="flex items-start gap-2.5">
                  <AlertTriangle size={16} className="text-amber-700 shrink-0 mt-0.5" />
                  <p className="text-xs">{conflictError}</p>
                </div>
                <Button
                  type="button"
                  onClick={handleResolveConflict}
                  variant="primary"
                  size="sm"
                  icon={<RefreshCw size={13} />}
                >
                  Sync with latest
                </Button>
              </div>
            )}

            {saveError && (
              <div className="mb-4 rounded-[var(--radius-control)] border border-rose-300 bg-rose-50 p-3 text-xs text-rose-800">
                {saveError}
              </div>
            )}

            <form onSubmit={handleSaveBrief} className="space-y-6">
              {/* 1. Target Roles */}
              <div>
                <label className="block text-xs font-semibold text-ink mb-1.5">Target Role Titles</label>
                <div className="flex flex-wrap gap-2 mb-2">
                  {targetRoles.map((role) => (
                    <span
                      key={role}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-indigo-tint/50 border border-indigo/20 text-xs font-medium text-ink"
                    >
                      {role}
                      <button
                        type="button"
                        onClick={() => setTargetRoles(targetRoles.filter((r) => r !== role))}
                        className="text-slate hover:text-rose-600"
                        aria-label={`Remove role ${role}`}
                      >
                        <X size={11} />
                      </button>
                    </span>
                  ))}
                </div>
                <div className="flex gap-2">
                  <Input
                    ref={initialFocusRef}
                    placeholder="e.g. Senior Backend Engineer"
                    value={newRoleInput}
                    onChange={(e) => setNewRoleInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        const trimmed = newRoleInput.trim();
                        if (trimmed && !targetRoles.includes(trimmed) && targetRoles.length < 20) {
                          setTargetRoles([...targetRoles, trimmed]);
                          setNewRoleInput("");
                        }
                      }
                    }}
                  />
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      const trimmed = newRoleInput.trim();
                      if (trimmed && !targetRoles.includes(trimmed) && targetRoles.length < 20) {
                        setTargetRoles([...targetRoles, trimmed]);
                        setNewRoleInput("");
                      }
                    }}
                  >
                    Add
                  </Button>
                </div>
              </div>

              {/* 2. Target Disciplines */}
              <div>
                <label className="block text-xs font-semibold text-ink mb-1.5">Target Disciplines</label>
                <div className="flex flex-wrap gap-1.5">
                  {CURATED_DISCIPLINES.map((d) => (
                    <FilterChip
                      key={d}
                      active={targetDisciplines.includes(d)}
                      onClick={() => toggleArrayItem(targetDisciplines, d, setTargetDisciplines)}
                    >
                      {d}
                    </FilterChip>
                  ))}
                </div>
              </div>

              {/* 3. Headline */}
              <div>
                <label className="block text-xs font-semibold text-ink mb-1.5">Professional Headline</label>
                <Input
                  value={headline}
                  onChange={(e) => setHeadline(e.target.value)}
                  placeholder="e.g. Staff Distributed Systems Engineer · Infrastructure & Storage"
                  maxLength={140}
                />
              </div>

              {/* 4. Biography (Full Bio editor to resolve ceiling) */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-semibold text-ink">Professional Biography</label>
                  <span className="text-[11px] font-mono text-slate">{bio.length}/2000</span>
                </div>
                <textarea
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  rows={3}
                  maxLength={2000}
                  placeholder="Briefly describe your career narrative, architecture experience, and the problems you solve best."
                  className="w-full rounded-[var(--radius-control)] border border-line bg-white px-3 py-2 text-sm text-ink focus:outline-hidden focus:ring-2 focus:ring-indigo/20 focus:border-indigo leading-relaxed"
                />
              </div>

              {/* 5. Seniority, Experience Years, Search Status */}
              <div className="grid sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-ink mb-1.5">Seniority Level</label>
                  <select
                    value={seniority ?? ""}
                    onChange={(e) => setSeniority((e.target.value as SeniorityLevel) || null)}
                    className="w-full rounded-[var(--radius-control)] border border-line bg-white px-3 py-2 text-sm text-ink focus:outline-hidden focus:ring-2 focus:ring-indigo/20 focus:border-indigo"
                  >
                    <option value="">Unspecified</option>
                    {SENIORITY_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-ink mb-1.5">Experience (Years)</label>
                  <Input
                    type="number"
                    min={0}
                    max={70}
                    value={expYears ?? ""}
                    onChange={(e) => {
                      const val = parseInt(e.target.value, 10);
                      setExpYears(isNaN(val) ? null : val);
                    }}
                    placeholder="e.g. 8"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-ink mb-1.5">Search Status</label>
                  <select
                    value={searchStatus ?? ""}
                    onChange={(e) => setSearchStatus((e.target.value as CandidateSearchStatus) || null)}
                    className="w-full rounded-[var(--radius-control)] border border-line bg-white px-3 py-2 text-sm text-ink focus:outline-hidden focus:ring-2 focus:ring-indigo/20 focus:border-indigo"
                  >
                    <option value="">Unspecified</option>
                    {SEARCH_STATUS_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* 6. Base Location & Timezone */}
              <div className="grid sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-ink mb-1.5">Current Country</label>
                  <select
                    value={currentCountry}
                    onChange={(e) => setCurrentCountry(e.target.value)}
                    className="w-full rounded-[var(--radius-control)] border border-line bg-white px-3 py-2 text-sm text-ink focus:outline-hidden focus:ring-2 focus:ring-indigo/20 focus:border-indigo"
                  >
                    <option value="">Select country…</option>
                    {COMMON_COUNTRIES.map((c) => (
                      <option key={c.code} value={c.code}>
                        {c.name} ({c.code})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-ink mb-1.5">Current City</label>
                  <Input
                    value={currentCity}
                    onChange={(e) => setCurrentCity(e.target.value)}
                    placeholder="e.g. London"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-ink mb-1.5">Timezone</label>
                  <Input
                    value={timezone}
                    onChange={(e) => setTimezone(e.target.value)}
                    placeholder="e.g. America/Los_Angeles"
                  />
                </div>
              </div>

              {/* 7. Remote & Sponsorship Tri-State */}
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-ink mb-1.5">Remote Work Mode</label>
                  <select
                    value={remotePref ?? ""}
                    onChange={(e) => setRemotePref((e.target.value as RemotePreference) || null)}
                    className="w-full rounded-[var(--radius-control)] border border-line bg-white px-3 py-2 text-sm text-ink focus:outline-hidden focus:ring-2 focus:ring-indigo/20 focus:border-indigo"
                  >
                    <option value="">Open to any</option>
                    {REMOTE_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-ink mb-1.5">
                    Visa Sponsorship Requirement
                  </label>
                  <select
                    value={visaNeeded === null ? "NOT_DECLARED" : visaNeeded ? "YES" : "NO"}
                    onChange={(e) => {
                      const v = e.target.value;
                      setVisaNeeded(v === "YES" ? true : v === "NO" ? false : null);
                    }}
                    className="w-full rounded-[var(--radius-control)] border border-line bg-white px-3 py-2 text-sm text-ink focus:outline-hidden focus:ring-2 focus:ring-indigo/20 focus:border-indigo"
                  >
                    {SPONSORSHIP_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* 8. Work Authorizations */}
              <div>
                <label className="block text-xs font-semibold text-ink mb-1.5">
                  Work Authorizations (Legal right to work without sponsorship)
                </label>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {COMMON_COUNTRIES.map((c) => (
                    <FilterChip
                      key={c.code}
                      active={workAuths.includes(c.code)}
                      onClick={() => toggleArrayItem(workAuths, c.code, setWorkAuths)}
                    >
                      {c.name}
                    </FilterChip>
                  ))}
                </div>
              </div>

              {/* 9. Preferred Target Countries & Relocation */}
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-ink mb-1.5">
                    Preferred Target Countries
                  </label>
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {COMMON_COUNTRIES.map((c) => (
                      <FilterChip
                        key={c.code}
                        active={preferredCountries.includes(c.code)}
                        onClick={() => toggleArrayItem(preferredCountries, c.code, setPreferredCountries)}
                      >
                        {c.name}
                      </FilterChip>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-ink mb-1.5">
                    Relocation Preference
                  </label>
                  <select
                    value={relocationPref ?? ""}
                    onChange={(e) => setRelocationPref((e.target.value as RelocationPreference) || null)}
                    className="w-full rounded-[var(--radius-control)] border border-line bg-white px-3 py-2 text-sm text-ink focus:outline-hidden focus:ring-2 focus:ring-indigo/20 focus:border-indigo"
                  >
                    <option value="">Not specified</option>
                    {RELOCATION_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* 10. Employment Types Accepted */}
              <div>
                <label className="block text-xs font-semibold text-ink mb-1.5">
                  Employment Types Accepted
                </label>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {EMPLOYMENT_TYPE_OPTIONS.map((t) => (
                    <FilterChip
                      key={t.value}
                      active={employmentTypes.includes(t.value as EmploymentType)}
                      onClick={() => toggleArrayItem(employmentTypes, t.value as EmploymentType, setEmploymentTypes)}
                    >
                      {t.label}
                    </FilterChip>
                  ))}
                </div>
              </div>

              {/* 11. Verified Skills */}
              <div>
                <label className="block text-xs font-semibold text-ink mb-1.5">Verified Skills</label>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {skills.map((s) => (
                    <span
                      key={s.displayName}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-soft border border-line text-xs font-medium text-ink"
                    >
                      {s.displayName}
                      <button
                        type="button"
                        onClick={() => setSkills(skills.filter((sk) => sk.displayName !== s.displayName))}
                        className="text-slate hover:text-rose-600"
                        aria-label={`Remove skill ${s.displayName}`}
                      >
                        <X size={11} />
                      </button>
                    </span>
                  ))}
                </div>
                <div className="flex gap-2">
                  <Input
                    placeholder="Add skill (e.g. Rust, Kubernetes)"
                    value={newSkillInput}
                    onChange={(e) => setNewSkillInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleAddSkill();
                      }
                    }}
                  />
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={handleAddSkill}
                  >
                    Add
                  </Button>
                </div>
              </div>

              {/* 12. Compensation Expectations (Optional) */}
              <div className="grid sm:grid-cols-4 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-ink mb-1.5">Min Salary</label>
                  <Input
                    type="number"
                    value={minSalary ?? ""}
                    onChange={(e) => setMinSalary(parseInt(e.target.value, 10) || undefined)}
                    placeholder="120000"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-ink mb-1.5">Target Salary</label>
                  <Input
                    type="number"
                    value={maxSalary ?? ""}
                    onChange={(e) => setMaxSalary(parseInt(e.target.value, 10) || undefined)}
                    placeholder="160000"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-ink mb-1.5">Currency</label>
                  <select
                    value={salaryCurrency ?? ""}
                    onChange={(e) => setSalaryCurrency(e.target.value || null)}
                    className="w-full rounded-[var(--radius-control)] border border-line bg-white px-3 py-2 text-sm text-ink focus:outline-hidden focus:ring-2 focus:ring-indigo/20 focus:border-indigo"
                  >
                    <option value="">Unspecified</option>
                    <option value="USD">USD ($)</option>
                    <option value="EUR">EUR (€)</option>
                    <option value="GBP">GBP (£)</option>
                    <option value="CAD">CAD ($)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-ink mb-1.5">Period</label>
                  <select
                    value={salaryPeriod ?? "ANNUAL"}
                    onChange={(e) => setSalaryPeriod((e.target.value as SalaryPeriod) || null)}
                    className="w-full rounded-[var(--radius-control)] border border-line bg-white px-3 py-2 text-sm text-ink focus:outline-hidden focus:ring-2 focus:ring-indigo/20 focus:border-indigo"
                  >
                    <option value="ANNUAL">Annual (/ yr)</option>
                    <option value="MONTHLY">Monthly (/ mo)</option>
                    <option value="HOURLY">Hourly (/ hr)</option>
                  </select>
                </div>
              </div>

              {/* Actions */}
              <div className="pt-4 border-t border-line flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-3">
                <Button
                  type="button"
                  variant="tertiary"
                  onClick={() => setIsEditing(false)}
                  disabled={isSaving || isCompleting}
                >
                  Cancel
                </Button>

                {isSkipped && (
                  <Button
                    type="button"
                    variant="primary"
                    onClick={handleCompleteBrief}
                    disabled={isSaving || isCompleting}
                    icon={
                      isCompleting ? (
                        <Loader2 size={15} className="animate-spin" />
                      ) : (
                        <Check size={15} />
                      )
                    }
                  >
                    {isCompleting ? "Completing…" : "Complete opportunity brief"}
                  </Button>
                )}

                <Button
                  type="submit"
                  variant={isSkipped ? "secondary" : "primary"}
                  disabled={isSaving || isCompleting}
                  icon={
                    isSaving ? (
                      <Loader2 size={15} className="animate-spin" />
                    ) : saveSuccess && !isCompleting ? (
                      <Check size={15} className="text-emerald" />
                    ) : (
                      <Check size={15} />
                    )
                  }
                >
                  {isSaving ? "Saving…" : saveSuccess && !isCompleting ? "Saved!" : "Save Changes"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </PageContainer>
  );
}
