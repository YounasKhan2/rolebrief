import { useEffect, useState } from "react";
import {
  FileText,
  Pencil,
  ShieldCheck,
  Lock,
  RefreshCw,
  Loader2,
  X,
  Plus,
  Check
} from "lucide-react";
import { PageContainer, PageHeader } from "../../components/shell/AppShell";
import { Kicker, Badge, Button, SectionRule, FilterChip } from "../../components/ui/primitives";
import { Input, SegmentedControl } from "../../components/ui/form";
import { useAuth } from "../../lib/auth";
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

const COMMON_COUNTRIES = [
  { code: "US", name: "United States" },
  { code: "GB", name: "United Kingdom" },
  { code: "CA", name: "Canada" },
  { code: "DE", name: "Germany" },
  { code: "PK", name: "Pakistan" },
  { code: "AE", name: "United Arab Emirates" },
  { code: "NL", name: "Netherlands" },
  { code: "FR", name: "France" },
  { code: "SG", name: "Singapore" },
  { code: "AU", name: "Australia" },
  { code: "IE", name: "Ireland" },
  { code: "IN", name: "India" }
];

const CURATED_DISCIPLINES = [
  "Software Engineering",
  "Frontend Engineering",
  "Backend Engineering",
  "Platform & DevOps",
  "Data & AI",
  "Product Design",
  "Engineering Management"
];

export function Component() {
  const [profileData, setProfileData] = useState<ProfileState | null>(null);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const { user, updateOnboardingStatus } = useAuth();
  const [isCompleting, setIsCompleting] = useState(false);

  // Edit form state
  const [targetRoles, setTargetRoles] = useState<string[]>([]);
  const [newRoleInput, setNewRoleInput] = useState("");
  const [targetDisciplines, setTargetDisciplines] = useState<string[]>([]);
  const [seniority, setSeniority] = useState<SeniorityLevel | null>(null);
  const [searchStatus, setSearchStatus] = useState<CandidateSearchStatus | null>(null);
  const [headline, setHeadline] = useState("");
  const [currentCountry, setCurrentCountry] = useState("");
  const [currentCity, setCurrentCity] = useState("");
  const [timezone, setTimezone] = useState("");
  const [workAuths, setWorkAuths] = useState<string[]>([]);
  const [visaNeeded, setVisaNeeded] = useState<boolean | null>(null);
  const [remotePref, setRemotePref] = useState<RemotePreference | null>(null);
  const [preferredCountries, setPreferredCountries] = useState<string[]>([]);
  const [employmentTypes, setEmploymentTypes] = useState<EmploymentType[]>([]);
  const [relocationPref, setRelocationPref] = useState<RelocationPreference | null>(null);
  const [skills, setSkills] = useState<CandidateSkillItem[]>([]);
  const [newSkillInput, setNewSkillInput] = useState("");
  const [expYears, setExpYears] = useState<number | null>(null);
  const [minSalary, setMinSalary] = useState<number | undefined>(undefined);
  const [maxSalary, setMaxSalary] = useState<number | undefined>(undefined);
  const [salaryCurrency, setSalaryCurrency] = useState<string | null>(null);
  const [salaryPeriod, setSalaryPeriod] = useState<SalaryPeriod | null>(null);

  async function load() {
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
  }

  useEffect(() => {
    void load();
  }, []);

  function populateEditForm(data: ProfileState) {
    if (data.preferences?.targetRoleTitles) setTargetRoles(data.preferences.targetRoleTitles);
    if (data.preferences?.targetDisciplines) setTargetDisciplines(data.preferences.targetDisciplines);
    if (data.profile?.seniorityLevel) setSeniority(data.profile.seniorityLevel);
    if (data.profile?.searchStatus) setSearchStatus(data.profile.searchStatus);
    if (data.profile?.headline) setHeadline(data.profile.headline);
    if (data.profile?.currentCountry) setCurrentCountry(data.profile.currentCountry);
    if (data.profile?.currentCity) setCurrentCity(data.profile.currentCity);
    setTimezone(data.profile?.timezone || "");
    if (data.profile?.workAuthorizations) setWorkAuths(data.profile.workAuthorizations);
    if (data.profile?.requiresVisaSponsorship !== null && data.profile?.requiresVisaSponsorship !== undefined) {
      setVisaNeeded(data.profile.requiresVisaSponsorship);
    }
    if (data.preferences?.remotePreference) setRemotePref(data.preferences.remotePreference);
    if (data.preferences?.preferredCountries) setPreferredCountries(data.preferences.preferredCountries);
    if (data.preferences?.employmentTypes) setEmploymentTypes(data.preferences.employmentTypes);
    if (data.preferences?.relocationPreference) setRelocationPref(data.preferences.relocationPreference);
    if (data.skills) setSkills(data.skills);
    if (data.profile?.experienceYears !== null && data.profile?.experienceYears !== undefined) {
      setExpYears(data.profile.experienceYears);
    }
    if (data.preferences?.minSalary) setMinSalary(data.preferences.minSalary);
    if (data.preferences?.maxSalary) setMaxSalary(data.preferences.maxSalary);
    if (data.preferences?.salaryCurrency) setSalaryCurrency(data.preferences.salaryCurrency);
    if (data.preferences?.salaryPeriod) setSalaryPeriod(data.preferences.salaryPeriod);
  }

  function toggleArrayItem(list: string[], item: string, setter: (items: string[]) => void) {
    if (list.includes(item)) {
      setter(list.filter((x) => x !== item));
    } else {
      setter([...list, item]);
    }
  }

  async function handleSaveBrief(e: React.FormEvent) {
    e.preventDefault();
    setIsSaving(true);
    setSaveError(null);
    try {
      const updated = await updateProfile({
        profile: {
          headline: headline || undefined,
          experienceYears: expYears ?? undefined,
          seniorityLevel: seniority || undefined,
          currentCountry: currentCountry || undefined,
          currentCity: currentCity || undefined,
          timezone: timezone || undefined,
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
      }, 800);
    } catch (err: unknown) {
      setIsSaving(false);
      setSaveError(err instanceof Error ? err.message : "Failed to update profile brief.");
    }
  }

  async function handleCompleteBrief() {
    setIsCompleting(true);
    setSaveError(null);
    try {
      // 1. Fetch current onboarding state to get current revision
      const onboardingState = await getOnboardingState();
      const currentRev = onboardingState.progress?.revision ?? 0;

      // 2. Save profile updates first
      const updated = await updateProfile({
        profile: {
          headline: headline || undefined,
          experienceYears: expYears ?? undefined,
          seniorityLevel: seniority || undefined,
          currentCountry: currentCountry || undefined,
          currentCity: currentCity || undefined,
          timezone: timezone || undefined,
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

      // 3. Atomically transition onboarding status to COMPLETED with matching expectedRevision
      await completeOnboarding({ expectedRevision: currentRev });

      // 4. Immediately update auth context
      updateOnboardingStatus("COMPLETED");

      setProfileData((prev) => (prev ? {
        ...prev,
        ...updated,
        progress: prev.progress ? { ...prev.progress, status: "COMPLETED" } : null
      } : null));
      populateEditForm(updated);
      setIsCompleting(false);
      setSaveSuccess(true);
      setTimeout(() => {
        setSaveSuccess(false);
        setIsEditing(false);
      }, 800);
    } catch (err: unknown) {
      setIsCompleting(false);
      setSaveError(err instanceof Error ? err.message : "Failed to complete opportunity brief.");
    }
  }

  const profile = profileData?.profile;
  const preferences = profileData?.preferences;
  const activeSkills = profileData?.skills ?? [];
  const completeness = profileData?.completeness ?? 0;
  const briefCompleteness = profileData?.briefCompleteness ?? 0;
  const isSkipped = user?.onboardingStatus === "SKIPPED" || profileData?.progress?.status === "SKIPPED";

  const fields = [
    {
      label: "Target roles",
      value: preferences?.targetRoleTitles?.length
        ? preferences.targetRoleTitles.join(", ")
        : "Not set"
    },
    {
      label: "Seniority & Search status",
      value: `${profile?.seniorityLevel ? profile.seniorityLevel : "Unspecified"} · ${
        profile?.searchStatus ? profile.searchStatus.replace(/_/g, " ") : "Not specified"
      }`
    },
    {
      label: "Primary disciplines",
      value: preferences?.targetDisciplines?.length
        ? preferences.targetDisciplines.join(", ")
        : profile?.primaryDiscipline || "Not set"
    },
    {
      label: "Professional headline",
      value: profile?.headline || "Not set"
    },
    {
      label: "Base location & Timezone",
      value: profile?.currentCountry
        ? `${profile.currentCity ? `${profile.currentCity}, ` : ""}${profile.currentCountry}${
            profile.timezone ? ` (${profile.timezone})` : ""
          }`
        : "Not set"
    },
    {
      label: "Remote preference",
      value: preferences?.remotePreference
        ? preferences.remotePreference.replace(/_/g, " ")
        : "Not specified"
    },
    {
      label: "Work authorizations",
      value: profile?.workAuthorizations?.length
        ? profile.workAuthorizations.join(", ")
        : "None declared"
    },
    {
      label: "Visa sponsorship & Relocation",
      value: `${
        profile?.requiresVisaSponsorship ? "Sponsorship required" : "No sponsorship required"
      } · ${preferences?.relocationPreference ? preferences.relocationPreference.replace(/_/g, " ") : "No relocation declared"}`
    },
    {
      label: "Preferred target countries",
      value: preferences?.preferredCountries?.length
        ? preferences.preferredCountries.join(", ")
        : "None declared"
    },
    {
      label: "Employment types",
      value: preferences?.employmentTypes?.length
        ? preferences.employmentTypes.join(", ")
        : "Full-time (default)"
    },
    {
      label: "Skills",
      value: activeSkills.length
        ? activeSkills.map((s) => s.displayName).join(", ")
        : "None added yet"
    },
    {
      label: "Compensation expectation",
      value: preferences?.minSalary
        ? `${preferences.salaryCurrency ?? "USD"} ${preferences.minSalary.toLocaleString()}${
            preferences.maxSalary ? ` – ${preferences.maxSalary.toLocaleString()}` : "+"
          } (${preferences.salaryPeriod ?? "YEARLY"})`
        : "Not disclosed"
    }
  ];

  if (loading && !profileData) {
    return (
      <PageContainer className="max-w-[980px]">
        <div className="py-24 flex flex-col items-center justify-center gap-3">
          <Loader2 size={24} className="animate-spin text-indigo" />
          <span className="text-xs font-mono uppercase tracking-widest text-slate">
            Loading profile…
          </span>
        </div>
      </PageContainer>
    );
  }

  return (
    <PageContainer className="max-w-[980px]">
      <PageHeader
        kicker="Candidate Profile"
        title="What powers your matches"
        description="Your canonical candidate brief. Match Briefs, Radar ranking, and eligibility filters are continuously computed from these preferences."
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

      {/* Dual Completeness Dashboard */}
      <div className="grid sm:grid-cols-2 gap-4 mb-6">
        <div className="rounded-[var(--radius-card)] border border-line bg-white p-5 shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <Kicker className="font-mono text-xs">Opportunity brief</Kicker>
            <span className="font-data text-sm font-semibold text-ink">{briefCompleteness}%</span>
          </div>
          <div className="h-2 rounded-full bg-line/60 overflow-hidden">
            <div
              className="h-full bg-indigo transition-all duration-500 rounded-full"
              style={{ width: `${briefCompleteness}%` }}
            />
          </div>
          <p className="text-xs text-slate mt-2">
            Powers your candidate ranking and Radar feed.
          </p>
        </div>

        <div className="rounded-[var(--radius-card)] border border-line bg-white p-5 shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <Kicker className="font-mono text-xs">Total profile completeness</Kicker>
            <span className="font-data text-sm font-semibold text-ink">{completeness}%</span>
          </div>
          <div className="h-2 rounded-full bg-line/60 overflow-hidden">
            <div
              className="h-full bg-emerald transition-all duration-500 rounded-full"
              style={{ width: `${completeness}%` }}
            />
          </div>
          <p className="text-xs text-slate mt-2">
            Includes professional headline, bio, and career history.
          </p>
        </div>
      </div>

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

      {/* Résumé Management Staging */}
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

      {/* Modal: Inline Opportunity Brief Editor */}
      {isEditing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="relative w-full max-w-2xl rounded-[var(--radius-feature)] border border-line bg-white p-6 sm:p-8 shadow-xl my-8 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-4 border-b border-line mb-6">
              <div>
                <h3 className="text-lg font-semibold text-ink font-serif">Update Opportunity Brief</h3>
                <p className="text-xs text-slate mt-0.5">Edit canonical candidate preferences in place.</p>
              </div>
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className="text-slate hover:text-ink transition-colors p-1"
              >
                <X size={18} />
              </button>
            </div>

            {saveError && (
              <div className="mb-4 rounded-[var(--radius-control)] border border-rose-300 bg-rose-50 p-3 text-xs text-rose-800">
                {saveError}
              </div>
            )}

            <form onSubmit={handleSaveBrief} className="space-y-6">
              {/* Target Roles */}
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
                      >
                        <X size={11} />
                      </button>
                    </span>
                  ))}
                </div>
                <div className="flex gap-2">
                  <Input
                    placeholder="e.g. Senior Backend Engineer"
                    value={newRoleInput}
                    onChange={(e) => setNewRoleInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        if (newRoleInput.trim() && !targetRoles.includes(newRoleInput.trim())) {
                          setTargetRoles([...targetRoles, newRoleInput.trim()]);
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
                      if (newRoleInput.trim() && !targetRoles.includes(newRoleInput.trim())) {
                        setTargetRoles([...targetRoles, newRoleInput.trim()]);
                        setNewRoleInput("");
                      }
                    }}
                  >
                    Add
                  </Button>
                </div>
              </div>

              {/* Disciplines */}
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

              {/* Seniority & Headline */}
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-ink mb-1.5">Seniority Level</label>
                  <select
                    value={seniority ?? ""}
                    onChange={(e) => setSeniority((e.target.value as SeniorityLevel) || null)}
                    className="w-full rounded-[var(--radius-control)] border border-line bg-white px-3 py-2 text-sm text-ink focus:outline-hidden focus:ring-2 focus:ring-indigo/20 focus:border-indigo"
                  >
                    <option value="">Unspecified</option>
                    <option value="MID">Mid</option>
                    <option value="SENIOR">Senior</option>
                    <option value="LEAD">Lead</option>
                    <option value="PRINCIPAL">Principal</option>
                    <option value="DIRECTOR">Director</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-ink mb-1.5">Search Status</label>
                  <select
                    value={searchStatus ?? ""}
                    onChange={(e) => setSearchStatus((e.target.value as CandidateSearchStatus) || null)}
                    className="w-full rounded-[var(--radius-control)] border border-line bg-white px-3 py-2 text-sm text-ink focus:outline-hidden focus:ring-2 focus:ring-indigo/20 focus:border-indigo"
                  >
                    <option value="">Unspecified</option>
                    <option value="ACTIVELY_LOOKING">Actively looking</option>
                    <option value="OPEN_TO_OFFERS">Open to offers</option>
                    <option value="CASUAL">Casual</option>
                    <option value="NOT_LOOKING">Not looking</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-ink mb-1.5">Professional Headline</label>
                <Input
                  value={headline}
                  onChange={(e) => setHeadline(e.target.value)}
                  placeholder="e.g. Staff Distributed Systems Engineer"
                />
              </div>

              {/* Location & Remote */}
              <div className="grid sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-ink mb-1.5">Current Country (ISO-2)</label>
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
                  <label className="block text-xs font-semibold text-ink mb-1.5">Remote Scope</label>
                  <select
                    value={remotePref ?? ""}
                    onChange={(e) => setRemotePref((e.target.value as RemotePreference) || null)}
                    className="w-full rounded-[var(--radius-control)] border border-line bg-white px-3 py-2 text-sm text-ink focus:outline-hidden focus:ring-2 focus:ring-indigo/20 focus:border-indigo"
                  >
                    <option value="">Open to any</option>
                    <option value="REMOTE_ONLY">Remote Only</option>
                    <option value="HYBRID">Hybrid</option>
                    <option value="ONSITE">On-site</option>
                    <option value="OPEN_TO_ANY">Open to Any</option>
                  </select>
                </div>
              </div>

              {/* Work Authorizations & Sponsorship */}
              <div>
                <label className="block text-xs font-semibold text-ink mb-1.5">Work Authorizations (No Sponsorship Needed)</label>
                <div className="flex flex-wrap gap-1.5 mb-3">
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

              {/* Employment Types Accepted */}
              <div>
                <label className="block text-xs font-semibold text-ink mb-1.5">Employment Types Accepted</label>
                <div className="flex flex-wrap gap-1.5 mb-3">
                  {[
                    { value: "FULL_TIME", label: "Full-time" },
                    { value: "CONTRACT", label: "Contract" },
                    { value: "PART_TIME", label: "Part-time" },
                    { value: "INTERNSHIP", label: "Internship" },
                    { value: "TEMPORARY", label: "Temporary" }
                  ].map((t) => (
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

              {/* Skills */}
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
                      >
                        <X size={11} />
                      </button>
                    </span>
                  ))}
                </div>
                <div className="flex gap-2">
                  <Input
                    placeholder="Add skill (e.g. Rust)"
                    value={newSkillInput}
                    onChange={(e) => setNewSkillInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        if (newSkillInput.trim() && !skills.some((sk) => sk.displayName.toLowerCase() === newSkillInput.trim().toLowerCase())) {
                          setSkills([...skills, { displayName: newSkillInput.trim() }]);
                          setNewSkillInput("");
                        }
                      }
                    }}
                  />
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      if (newSkillInput.trim() && !skills.some((sk) => sk.displayName.toLowerCase() === newSkillInput.trim().toLowerCase())) {
                        setSkills([...skills, { displayName: newSkillInput.trim() }]);
                        setNewSkillInput("");
                      }
                    }}
                  >
                    Add
                  </Button>
                </div>
              </div>

              {/* Compensation */}
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
