import { useEffect, useRef, useState, useTransition } from "react";
import { Link, useNavigate } from "react-router";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  FileText,
  Globe,
  Info,
  Loader2,
  Lock,
  Plus,
  Sparkles,
  X
} from "lucide-react";
import { Button, FilterChip, Kicker } from "../../components/ui/primitives";
import { Input, SegmentedControl } from "../../components/ui/form";
import { classNames } from "../../lib/format";
import { useOnboarding } from "../../components/auth/OnboardingGate";
import { useOnboardingLayout } from "../../layouts/OnboardingLayout";
import {
  autosaveOnboarding,
  completeOnboarding,
  skipOnboarding,
  CandidateSkillItem,
  RemotePreference,
  SeniorityLevel
} from "../../lib/onboarding-api";
import { ApiError } from "../../lib/api";

const stepNames = ["Goal", "Reach", "Fit", "Review"] as const;

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

const CURATED_SKILLS = [
  "TypeScript",
  "React",
  "Node.js",
  "Python",
  "PostgreSQL",
  "Go",
  "Rust",
  "AWS",
  "Kubernetes",
  "GraphQL",
  "Docker",
  "Redis"
];

export function Component() {
  const navigate = useNavigate();
  const { state, refresh: refreshGateState, updateStateLocally } = useOnboarding();
  const { setSaveStatus, setStatusMessage } = useOnboardingLayout();
  const [, startTransition] = useTransition();

  // Wizard state initialized from canonical database state
  const [step, setStep] = useState(0);
  const [revision, setRevision] = useState(state?.progress?.revision ?? 0);

  // Step 1: Goal
  const [targetRoleTitles, setTargetRoleTitles] = useState<string[]>(
    state?.preferences?.targetRoleTitles?.length
      ? state.preferences.targetRoleTitles
      : ["Senior Software Engineer"]
  );
  const [newRoleInput, setNewRoleInput] = useState("");
  const [targetDisciplines, setTargetDisciplines] = useState<string[]>(
    state?.preferences?.targetDisciplines?.length
      ? state.preferences.targetDisciplines
      : ["Software Engineering"]
  );
  const [seniority, setSeniority] = useState<SeniorityLevel>(
    state?.profile?.seniorityLevel ?? "SENIOR"
  );
  const [headline, setHeadline] = useState(
    state?.profile?.headline ?? "Software Engineer"
  );

  // Step 2: Reach (Location, Remote, Authorizations)
  const [currentCountry, setCurrentCountry] = useState<string>(
    state?.profile?.currentCountry ?? "US"
  );
  const [currentCity, setCurrentCity] = useState<string>(
    state?.profile?.currentCity ?? ""
  );
  const [remotePreference, setRemotePreference] = useState<RemotePreference>(
    state?.preferences?.remotePreference ?? "OPEN_TO_ANY"
  );
  const [workAuthorizations, setWorkAuthorizations] = useState<string[]>(
    state?.profile?.workAuthorizations?.length
      ? state.profile.workAuthorizations
      : ["US"]
  );
  const [preferredCountries, setPreferredCountries] = useState<string[]>(
    state?.preferences?.preferredCountries?.length
      ? state.preferences.preferredCountries
      : ["US"]
  );

  // Step 3: Fit (Skills, Experience)
  const [skills, setSkills] = useState<CandidateSkillItem[]>(
    state?.skills?.length
      ? state.skills
      : [{ displayName: "TypeScript" }, { displayName: "React" }]
  );
  const [newSkillInput, setNewSkillInput] = useState("");
  const [experienceYears, setExperienceYears] = useState<number>(
    state?.profile?.experienceYears ?? 5
  );

  // Step 4: Compensation & Alert Staging
  const [minSalary, setMinSalary] = useState<number | undefined>(
    state?.preferences?.minSalary ?? 120000
  );
  const [maxSalary, setMaxSalary] = useState<number | undefined>(
    state?.preferences?.maxSalary ?? 180000
  );
  const [salaryCurrency, setSalaryCurrency] = useState<string>(
    state?.preferences?.salaryCurrency ?? "USD"
  );

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSkipping, setIsSkipping] = useState(false);
  const [conflictError, setConflictError] = useState<string | null>(null);

  // Autosave debouncing ref
  const autosaveTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isFirstMount = useRef(true);

  // Keep local revision in sync when gate state reloads
  useEffect(() => {
    if (state?.progress?.revision !== undefined) {
      setRevision(state.progress.revision);
    }
  }, [state?.progress?.revision]);

  // Autosave trigger on field modifications
  useEffect(() => {
    if (isFirstMount.current) {
      isFirstMount.current = false;
      return;
    }

    if (autosaveTimerRef.current) {
      clearTimeout(autosaveTimerRef.current);
    }

    setSaveStatus("saving");

    autosaveTimerRef.current = setTimeout(async () => {
      try {
        const payload = {
          expectedRevision: revision,
          currentStep: stepNames[step].toLowerCase(),
          completedSteps: stepNames.slice(0, step).map((s) => s.toLowerCase()),
          profile: {
            headline,
            experienceYears,
            seniorityLevel: seniority,
            currentCountry,
            currentCity: currentCity || undefined,
            workAuthorizations
          },
          preferences: {
            targetRoleTitles,
            targetDisciplines,
            remotePreference,
            preferredCountries,
            minSalary: minSalary || undefined,
            maxSalary: maxSalary || undefined,
            salaryCurrency
          },
          skills
        };

        const updated = await autosaveOnboarding(payload);
        setRevision(updated.progress.revision);
        updateStateLocally(updated);
        setSaveStatus("saved");
        setConflictError(null);
      } catch (err: unknown) {
        if (err instanceof ApiError && err.status === 409) {
          setSaveStatus("conflict");
          setStatusMessage("Sync conflict — reload needed");
          setConflictError("Your profile was modified in another session. Please reload to sync the latest version.");
        } else {
          setSaveStatus("error");
        }
      }
    }, 800);

    return () => {
      if (autosaveTimerRef.current) {
        clearTimeout(autosaveTimerRef.current);
      }
    };
  }, [
    step,
    revision,
    targetRoleTitles,
    targetDisciplines,
    seniority,
    headline,
    currentCountry,
    currentCity,
    remotePreference,
    workAuthorizations,
    preferredCountries,
    skills,
    experienceYears,
    minSalary,
    maxSalary,
    salaryCurrency,
    setSaveStatus,
    setStatusMessage,
    updateStateLocally
  ]);

  // Helpers to toggle items in arrays
  function toggleArrayItem(list: string[], item: string, setter: (items: string[]) => void) {
    if (list.includes(item)) {
      if (list.length > 1) {
        setter(list.filter((x) => x !== item));
      }
    } else {
      setter([...list, item]);
    }
  }

  function addTargetRole() {
    const trimmed = newRoleInput.trim();
    if (trimmed && !targetRoleTitles.includes(trimmed)) {
      setTargetRoleTitles([...targetRoleTitles, trimmed]);
      setNewRoleInput("");
    }
  }

  function removeTargetRole(role: string) {
    if (targetRoleTitles.length > 1) {
      setTargetRoleTitles(targetRoleTitles.filter((r) => r !== role));
    }
  }

  function toggleSkill(name: string) {
    const norm = name.trim().toLowerCase();
    const exists = skills.some((s) => s.displayName.trim().toLowerCase() === norm);
    if (exists) {
      if (skills.length > 1) {
        setSkills(skills.filter((s) => s.displayName.trim().toLowerCase() !== norm));
      }
    } else {
      setSkills([...skills, { displayName: name.trim() }]);
    }
  }

  function addCustomSkill() {
    const trimmed = newSkillInput.trim();
    if (!trimmed) return;
    const norm = trimmed.toLowerCase();
    if (!skills.some((s) => s.displayName.trim().toLowerCase() === norm)) {
      setSkills([...skills, { displayName: trimmed }]);
      setNewSkillInput("");
    }
  }

  function removeSkill(name: string) {
    if (skills.length > 1) {
      setSkills(skills.filter((s) => s.displayName !== name));
    }
  }

  async function handleSkip() {
    setIsSkipping(true);
    try {
      await skipOnboarding();
      await refreshGateState();
      startTransition(() => {
        navigate("/app/radar", { replace: true });
      });
    } catch {
      setIsSkipping(false);
    }
  }

  async function handleComplete() {
    setIsSubmitting(true);
    try {
      await completeOnboarding();
      await refreshGateState();
      startTransition(() => {
        navigate("/app/radar", { replace: true });
      });
    } catch {
      setIsSubmitting(false);
    }
  }

  const handleNext = () => {
    if (step < 3) {
      setStep(step + 1);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } else {
      void handleComplete();
    }
  };

  const handleBack = () => {
    if (step > 0) {
      setStep(step - 1);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  return (
    <div className="w-full flex-1 flex flex-col items-center py-8 px-4 sm:px-6">
      <div className="w-full max-w-3xl">
        {/* Step Progress Bar */}
        <div className="mb-8 flex items-center justify-between">
          <ol className="flex items-center gap-2 grow max-w-xl">
            {stepNames.map((name, i) => (
              <li key={name} className="flex items-center gap-2 grow last:grow-0">
                <button
                  type="button"
                  onClick={() => i < step && setStep(i)}
                  disabled={i > step}
                  className={classNames(
                    "inline-flex items-center gap-2 text-[13px] font-medium transition-colors",
                    i <= step ? "text-ink cursor-pointer" : "text-slate/60 cursor-not-allowed"
                  )}
                >
                  <span
                    className={classNames(
                      "inline-flex items-center justify-center size-6 rounded-full text-[12px] font-data font-semibold",
                      i < step
                        ? "bg-emerald text-white"
                        : i === step
                          ? "bg-indigo text-white shadow-xs"
                          : "bg-soft border border-line text-slate"
                    )}
                  >
                    {i < step ? <Check size={13} className="stroke-[3]" /> : i + 1}
                  </span>
                  <span className="hidden sm:inline font-sans">{name}</span>
                </button>
                {i < 3 && (
                  <span
                    className={classNames(
                      "h-px grow transition-colors",
                      i < step ? "bg-emerald" : "bg-line"
                    )}
                  />
                )}
              </li>
            ))}
          </ol>

          {/* Prominent Immediate Skip Link */}
          <button
            type="button"
            onClick={handleSkip}
            disabled={isSkipping || isSubmitting}
            className="text-xs font-mono uppercase tracking-wider text-slate hover:text-ink transition-colors cursor-pointer disabled:opacity-50"
          >
            {isSkipping ? "Skipping…" : "Skip for now →"}
          </button>
        </div>

        {/* Sync Conflict Warning Banner */}
        {conflictError && (
          <div className="mb-6 rounded-[var(--radius-card)] border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 flex items-center justify-between">
            <p>{conflictError}</p>
            <Button
              onClick={() => void refreshGateState()}
              variant="secondary"
              size="sm"
            >
              Sync Latest
            </Button>
          </div>
        )}

        {/* Step Card */}
        <div className="rounded-[var(--radius-feature)] border border-line bg-white p-7 sm:p-10 shadow-sm">
          {/* STEP 0: GOAL */}
          {step === 0 && (
            <Section
              kicker="Step 1 of 4 · Career Goal"
              title="What roles are you targeting?"
              desc="RoleBrief uses your target titles and disciplines to compute Match Briefs and rank your personalized Radar."
            >
              <Field label="Target Role Titles">
                <div className="space-y-3">
                  <div className="flex flex-wrap gap-2">
                    {targetRoleTitles.map((role) => (
                      <span
                        key={role}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[var(--radius-pill)] bg-indigo-tint/50 border border-indigo/20 text-xs font-medium text-ink"
                      >
                        {role}
                        {targetRoleTitles.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeTargetRole(role)}
                            className="text-slate hover:text-rose-600 transition-colors"
                          >
                            <X size={12} />
                          </button>
                        )}
                      </span>
                    ))}
                  </div>

                  <div className="flex items-center gap-2 max-w-md">
                    <Input
                      placeholder="e.g. Lead Backend Engineer"
                      value={newRoleInput}
                      onChange={(e) => setNewRoleInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          addTargetRole();
                        }
                      }}
                    />
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={addTargetRole}
                      icon={<Plus size={14} />}
                    >
                      Add
                    </Button>
                  </div>
                </div>
              </Field>

              <Field label="Primary Discipline">
                <div className="flex flex-wrap gap-2">
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
              </Field>

              <Field label="Target Seniority Level">
                <SegmentedControl
                  value={seniority}
                  onChange={(v) => setSeniority(v as SeniorityLevel)}
                  options={[
                    { value: "MID", label: "Mid" },
                    { value: "SENIOR", label: "Senior" },
                    { value: "LEAD", label: "Lead" },
                    { value: "PRINCIPAL", label: "Principal" },
                    { value: "DIRECTOR", label: "Director" }
                  ]}
                />
              </Field>

              <Field label="Professional Headline">
                <Input
                  value={headline}
                  onChange={(e) => setHeadline(e.target.value)}
                  placeholder="e.g. Senior Full Stack Engineer · Distributed Systems"
                  maxLength={120}
                />
              </Field>
            </Section>
          )}

          {/* STEP 1: REACH */}
          {step === 1 && (
            <Section
              kicker="Step 2 of 4 · Geographic Reach"
              title="Where are you authorized and willing to work?"
              desc="We strictly enforce ISO-standard work eligibility and remote boundaries to shield you from ineligible job listings."
            >
              <div className="grid sm:grid-cols-2 gap-5">
                <Field label="Current Base Country">
                  <select
                    value={currentCountry}
                    onChange={(e) => setCurrentCountry(e.target.value)}
                    className="w-full rounded-[var(--radius-control)] border border-line bg-white px-3 py-2 text-sm text-ink focus:outline-hidden focus:ring-2 focus:ring-indigo/20 focus:border-indigo"
                  >
                    {COMMON_COUNTRIES.map((c) => (
                      <option key={c.code} value={c.code}>
                        {c.name} ({c.code})
                      </option>
                    ))}
                  </select>
                </Field>

                <Field label="Current City (Optional)">
                  <Input
                    placeholder="e.g. San Francisco or London"
                    value={currentCity}
                    onChange={(e) => setCurrentCity(e.target.value)}
                  />
                </Field>
              </div>

              <Field label="Remote Work Mode">
                <SegmentedControl
                  value={remotePreference}
                  onChange={(v) => setRemotePreference(v as RemotePreference)}
                  options={[
                    { value: "REMOTE_ONLY", label: "Remote Only" },
                    { value: "HYBRID", label: "Hybrid" },
                    { value: "ONSITE", label: "On-site" },
                    { value: "OPEN_TO_ANY", label: "Open to Any" }
                  ]}
                />
              </Field>

              <Field label="Work Authorization Countries (ISO-2)">
                <p className="text-xs text-slate mb-2">Select all countries where you hold legal right to work without sponsorship.</p>
                <div className="flex flex-wrap gap-2">
                  {COMMON_COUNTRIES.map((c) => (
                    <FilterChip
                      key={c.code}
                      active={workAuthorizations.includes(c.code)}
                      onClick={() => toggleArrayItem(workAuthorizations, c.code, setWorkAuthorizations)}
                    >
                      {c.name}
                    </FilterChip>
                  ))}
                </div>
              </Field>

              <Field label="Preferred Target Locations">
                <p className="text-xs text-slate mb-2">Countries where you would actively welcome job opportunities.</p>
                <div className="flex flex-wrap gap-2">
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
              </Field>
            </Section>
          )}

          {/* STEP 2: FIT */}
          {step === 2 && (
            <Section
              kicker="Step 3 of 4 · Skills & Fit"
              title="What core strengths power your profile?"
              desc="Skills power your automated Match Brief. Add your top technical competencies and total experience."
            >
              <Field label="Your Core Skills">
                <div className="space-y-3">
                  <div className="flex flex-wrap gap-2">
                    {skills.map((s) => (
                      <span
                        key={s.displayName}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[var(--radius-pill)] bg-indigo-tint/50 border border-indigo/20 text-xs font-medium text-ink"
                      >
                        {s.displayName}
                        {skills.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeSkill(s.displayName)}
                            className="text-slate hover:text-rose-600 transition-colors"
                          >
                            <X size={12} />
                          </button>
                        )}
                      </span>
                    ))}
                  </div>

                  <div className="flex items-center gap-2 max-w-md">
                    <Input
                      placeholder="Add custom skill (e.g. Next.js)"
                      value={newSkillInput}
                      onChange={(e) => setNewSkillInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          addCustomSkill();
                        }
                      }}
                    />
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={addCustomSkill}
                      icon={<Plus size={14} />}
                    >
                      Add
                    </Button>
                  </div>
                </div>
              </Field>

              <Field label="Popular Competencies">
                <div className="flex flex-wrap gap-2">
                  {CURATED_SKILLS.map((s) => (
                    <FilterChip
                      key={s}
                      active={skills.some((sk) => sk.displayName.toLowerCase() === s.toLowerCase())}
                      onClick={() => toggleSkill(s)}
                    >
                      {s}
                    </FilterChip>
                  ))}
                </div>
              </Field>

              <Field label="Total Years of Professional Experience">
                <div className="max-w-[160px]">
                  <Input
                    type="number"
                    min={0}
                    max={50}
                    value={experienceYears}
                    onChange={(e) => setExperienceYears(parseInt(e.target.value, 10) || 0)}
                  />
                </div>
              </Field>

              {/* Honest Coming Soon Staging for Résumé Parser */}
              <Field label="Automated Résumé Extraction">
                <div className="rounded-[var(--radius-card)] border border-line bg-paper/60 p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="size-10 rounded-full bg-soft border border-line flex items-center justify-center text-slate">
                      <FileText size={18} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-ink">CV & Résumé Parser</span>
                        <span className="inline-flex items-center gap-1 text-[11px] font-mono px-2 py-0.5 rounded-full bg-slate/10 text-slate font-medium">
                          <Lock size={10} /> Coming Soon
                        </span>
                      </div>
                      <p className="text-xs text-slate mt-0.5">
                        Deep PDF/DOCX skill extraction will be available in an upcoming release. Manual skill selection is fully supported above.
                      </p>
                    </div>
                  </div>
                  <Button variant="tertiary" size="sm" disabled>
                    Upload disabled
                  </Button>
                </div>
              </Field>
            </Section>
          )}

          {/* STEP 3: REVIEW & COMPENSATION */}
          {step === 3 && (
            <Section
              kicker="Step 4 of 4 · Review Brief"
              title="Review your opportunity brief"
              desc="Confirm your foundational preferences. You can update any of these settings at any time from your profile."
            >
              <div className="grid sm:grid-cols-2 gap-4">
                <ReviewRow label="Target Roles" value={targetRoleTitles.join(", ")} />
                <ReviewRow label="Seniority & Headline" value={`${seniority} · ${headline}`} />
                <ReviewRow label="Primary Discipline" value={targetDisciplines.join(", ")} />
                <ReviewRow label="Base Location" value={`${currentCity ? `${currentCity}, ` : ""}${currentCountry}`} />
                <ReviewRow label="Remote Scope" value={remotePreference.replace(/_/g, " ")} />
                <ReviewRow label="Authorized Countries" value={workAuthorizations.join(", ")} />
                <ReviewRow label="Skills" value={skills.map((s) => s.displayName).join(", ")} />
                <ReviewRow label="Experience" value={`${experienceYears} years`} />
              </div>

              <div className="pt-2 border-t border-line space-y-4">
                <div className="grid sm:grid-cols-3 gap-4">
                  <Field label="Minimum Base Salary">
                    <Input
                      type="number"
                      step={5000}
                      value={minSalary || ""}
                      onChange={(e) => setMinSalary(parseInt(e.target.value, 10) || undefined)}
                      placeholder="e.g. 120000"
                    />
                  </Field>
                  <Field label="Target Base Salary">
                    <Input
                      type="number"
                      step={5000}
                      value={maxSalary || ""}
                      onChange={(e) => setMaxSalary(parseInt(e.target.value, 10) || undefined)}
                      placeholder="e.g. 160000"
                    />
                  </Field>
                  <Field label="Currency">
                    <select
                      value={salaryCurrency}
                      onChange={(e) => setSalaryCurrency(e.target.value)}
                      className="w-full rounded-[var(--radius-control)] border border-line bg-white px-3 py-2 text-sm text-ink focus:outline-hidden focus:ring-2 focus:ring-indigo/20 focus:border-indigo"
                    >
                      <option value="USD">USD ($)</option>
                      <option value="EUR">EUR (€)</option>
                      <option value="GBP">GBP (£)</option>
                      <option value="CAD">CAD ($)</option>
                    </select>
                  </Field>
                </div>

                {/* Honest Coming Soon Staging for Job Alerts */}
                <div className="rounded-[var(--radius-card)] border border-indigo/20 bg-indigo-tint/40 p-4 flex items-start gap-3">
                  <Sparkles size={18} className="text-indigo shrink-0 mt-0.5" />
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-ink">Automated Job Alerts</span>
                      <span className="inline-flex items-center gap-1 text-[11px] font-mono px-2 py-0.5 rounded-full bg-indigo/10 text-indigo font-medium">
                        Coming in Alerts Phase
                      </span>
                    </div>
                    <p className="text-xs text-slate mt-1">
                      Real-time push and email notifications based on your opportunity brief are coming soon. Your saved preferences will automatically configure your alert filters when enabled.
                    </p>
                  </div>
                </div>
              </div>
            </Section>
          )}

          {/* Wizard Controls */}
          <div className="mt-10 pt-6 border-t border-line flex items-center justify-between gap-4">
            {step > 0 ? (
              <Button
                variant="tertiary"
                onClick={handleBack}
                icon={<ArrowLeft size={15} />}
                disabled={isSubmitting}
              >
                Back
              </Button>
            ) : (
              <button
                type="button"
                onClick={handleSkip}
                disabled={isSkipping || isSubmitting}
                className="text-sm text-slate hover:text-ink transition-colors cursor-pointer"
              >
                Skip for now
              </button>
            )}

            <Button
              onClick={handleNext}
              size="lg"
              disabled={isSubmitting || isSkipping}
              icon={
                isSubmitting ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <ArrowRight size={16} />
                )
              }
            >
              {step === 3 ? (isSubmitting ? "Completing…" : "Enter Workspace") : "Continue"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Section({
  kicker,
  title,
  desc,
  children
}: {
  kicker: string;
  title: string;
  desc: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <Kicker className="mb-2 text-indigo font-mono">{kicker}</Kicker>
      <h1 className="text-2xl font-semibold text-ink tracking-tight font-serif">{title}</h1>
      <p className="text-sm text-slate mt-1.5 leading-relaxed">{desc}</p>
      <div className="mt-8 space-y-7">{children}</div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[13px] font-semibold text-ink mb-2">{label}</p>
      {children}
    </div>
  );
}

function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[var(--radius-card)] border border-line bg-paper/50 p-4">
      <p className="kicker text-[11px] font-mono text-slate mb-1">{label}</p>
      <p className="text-sm font-medium text-ink break-words">{value || "—"}</p>
    </div>
  );
}
