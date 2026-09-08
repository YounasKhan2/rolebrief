import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { useLocation, useNavigate } from "react-router";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  FileText,
  Loader2,
  Lock,
  Plus,
  RefreshCw,
  Sparkles,
  X
} from "lucide-react";
import { Button, FilterChip, Kicker } from "../../components/ui/primitives";
import { Input, SegmentedControl } from "../../components/ui/form";
import { classNames } from "../../lib/format";
import { useAuth } from "../../lib/auth";
import { useOnboardingLayout } from "../../layouts/OnboardingLayout";
import { sanitizeReturnTo } from "../../lib/routing";
import {
  autosaveOnboarding,
  completeOnboarding,
  getOnboardingState,
  skipOnboarding,
  CandidateSearchStatus,
  CandidateSkillItem,
  EmploymentType,
  OnboardingState,
  OnboardingStep,
  RelocationPreference,
  RemotePreference,
  SalaryPeriod,
  SeniorityLevel
} from "../../lib/onboarding-api";
import { ApiError } from "../../lib/api";
import {
  COMMON_COUNTRIES,
  CURATED_DISCIPLINES,
  CURATED_SKILLS,
  SENIORITY_OPTIONS,
  SPONSORSHIP_OPTIONS
} from "../../lib/taxonomies";

const STEP_ENUMS: OnboardingStep[] = ["GOAL", "REACH", "FIT", "REVIEW"];
const stepDisplayNames = ["Goal", "Reach", "Fit", "Review"] as const;

export function Component() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, isAdmin, updateOnboardingStatus } = useAuth();
  const { setSaveStatus, setStatusMessage, setRetryAutosave } = useOnboardingLayout();
  const [, startTransition] = useTransition();

  const searchParams = new URLSearchParams(location.search);
  const returnTo = sanitizeReturnTo(searchParams.get("returnTo"));

  // Initial loading & re-entry states
  const [loading, setLoading] = useState(true);
  const [initError, setInitError] = useState<string | null>(null);

  // Wizard step (0 = GOAL, 1 = REACH, 2 = FIT, 3 = REVIEW)
  const [step, setStep] = useState(0);
  const [revision, setRevision] = useState(0);
  const [candidateRevision, setCandidateRevision] = useState(0);

  // Step 1: Goal
  const [targetRoleTitles, setTargetRoleTitles] = useState<string[]>([]);
  const [newRoleInput, setNewRoleInput] = useState("");
  const [targetDisciplines, setTargetDisciplines] = useState<string[]>([]);
  const [seniority, setSeniority] = useState<SeniorityLevel | null>(null);
  const [searchStatus, setSearchStatus] = useState<CandidateSearchStatus | null>(null);
  const [headline, setHeadline] = useState("");

  // Step 2: Reach (Location, Remote, Authorizations, Relocation)
  const [currentCountry, setCurrentCountry] = useState<string>("");
  const [currentCity, setCurrentCity] = useState<string>("");
  const [timezone, setTimezone] = useState<string>("");
  const [remotePreference, setRemotePreference] = useState<RemotePreference | null>(null);
  const [workAuthorizations, setWorkAuthorizations] = useState<string[]>([]);
  const [requiresVisaSponsorship, setRequiresVisaSponsorship] = useState<boolean | null>(null);
  const [preferredCountries, setPreferredCountries] = useState<string[]>([]);
  const [employmentTypes, setEmploymentTypes] = useState<EmploymentType[]>([]);
  const [relocationPreference, setRelocationPreference] = useState<RelocationPreference | null>(null);

  // Step 3: Fit (Skills, Experience)
  const [skills, setSkills] = useState<CandidateSkillItem[]>([]);
  const [newSkillInput, setNewSkillInput] = useState("");
  const [experienceYears, setExperienceYears] = useState<number | null>(null);

  // Step 4: Compensation & Review
  const [minSalary, setMinSalary] = useState<number | undefined>(undefined);
  const [maxSalary, setMaxSalary] = useState<number | undefined>(undefined);
  const [salaryCurrency, setSalaryCurrency] = useState<string | null>(null);
  const [salaryPeriod, setSalaryPeriod] = useState<SalaryPeriod | null>(null);

  const [briefScore, setBriefScore] = useState<number>(0);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSkipping, setIsSkipping] = useState(false);
  const [conflictError, setConflictError] = useState<string | null>(null);
  const [conflictServerState, setConflictServerState] = useState<OnboardingState | null>(null);

  const autosaveTimerRef = useRef<NodeJS.Timeout | null>(null);
  const requestIdRef = useRef(0);
  const isLoadedRef = useRef(false);
  const isTransitioningRef = useRef(false);

  // Initial load & Re-entry check
  useEffect(() => {
    // If currently submitting or skipping, do not run re-entry check
    if (isTransitioningRef.current) return;

    // 1. Admin bypass: Admins never do candidate onboarding
    if (isAdmin) {
      navigate("/admin", { replace: true });
      return;
    }

    // 2. AuthUser fast re-entry check (for users navigating into /app/onboarding when already completed/skipped)
    if (user?.onboardingStatus === "COMPLETED" || user?.onboardingStatus === "SKIPPED") {
      navigate("/app/profile", { replace: true });
      return;
    }

    let mounted = true;
    async function load() {
      try {
        setLoading(true);
        setInitError(null);
        const data = await getOnboardingState();
        if (!mounted) return;

        // Check if database says completed or skipped
        if (data.progress.status === "COMPLETED" || data.progress.status === "SKIPPED") {
          updateOnboardingStatus(data.progress.status);
          navigate("/app/profile", { replace: true });
          return;
        }

        // Initialize state from DB without inserting deceptive defaults
        setRevision(data.progress.revision);
        setCandidateRevision(data.profileRevision ?? data.profile?.revision ?? 0);

        // Map step enum to index
        const stepIdx = STEP_ENUMS.indexOf(data.progress.currentStep);
        if (stepIdx >= 0) {
          setStep(stepIdx);
        }

        if (data.preferences?.targetRoleTitles) setTargetRoleTitles(data.preferences.targetRoleTitles);
        if (data.preferences?.targetDisciplines) setTargetDisciplines(data.preferences.targetDisciplines);
        if (data.profile?.seniorityLevel) setSeniority(data.profile.seniorityLevel);
        if (data.profile?.searchStatus) setSearchStatus(data.profile.searchStatus);
        if (data.profile?.headline) setHeadline(data.profile.headline);

        if (data.profile?.currentCountry) setCurrentCountry(data.profile.currentCountry);
        if (data.profile?.currentCity) setCurrentCity(data.profile.currentCity);
        setTimezone(data.profile?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC");
        if (data.profile?.workAuthorizations) setWorkAuthorizations(data.profile.workAuthorizations);
        if (data.profile?.requiresVisaSponsorship !== null && data.profile?.requiresVisaSponsorship !== undefined) {
          setRequiresVisaSponsorship(data.profile.requiresVisaSponsorship);
        }
        if (data.preferences?.remotePreference) setRemotePreference(data.preferences.remotePreference);
        if (data.preferences?.preferredCountries) setPreferredCountries(data.preferences.preferredCountries);
        if (data.preferences?.employmentTypes) setEmploymentTypes(data.preferences.employmentTypes);
        if (data.preferences?.relocationPreference) setRelocationPreference(data.preferences.relocationPreference);

        if (data.skills) setSkills(data.skills);
        if (data.profile?.experienceYears !== null && data.profile?.experienceYears !== undefined) {
          setExperienceYears(data.profile.experienceYears);
        }

        if (data.preferences?.minSalary) setMinSalary(data.preferences.minSalary);
        if (data.preferences?.maxSalary) setMaxSalary(data.preferences.maxSalary);
        if (data.preferences?.salaryCurrency) setSalaryCurrency(data.preferences.salaryCurrency);
        if (data.preferences?.salaryPeriod) setSalaryPeriod(data.preferences.salaryPeriod);

        if (data.briefCompleteness !== undefined) setBriefScore(data.briefCompleteness);

        setLoading(false);
        // Mark as loaded so autosave can run on subsequent user modifications
        setTimeout(() => {
          isLoadedRef.current = true;
        }, 100);
      } catch (err: unknown) {
        if (!mounted) return;
        setInitError(err instanceof Error ? err.message : "Could not load onboarding state.");
        setLoading(false);
      }
    }

    void load();
    return () => {
      mounted = false;
    };
  }, [isAdmin, user?.onboardingStatus, navigate, updateOnboardingStatus]);

  const buildPayload = useCallback((targetStep: number, targetRev: number) => {
    return {
      expectedRevision: targetRev,
      expectedCandidateRevision: candidateRevision,
      currentStep: STEP_ENUMS[targetStep],
      completedSteps: STEP_ENUMS.slice(0, targetStep),
      profile: {
        headline: headline || undefined,
        experienceYears: experienceYears ?? undefined,
        seniorityLevel: seniority || undefined,
        currentCountry: currentCountry || undefined,
        currentCity: currentCity || undefined,
        timezone: timezone || undefined,
        workAuthorizations,
        requiresVisaSponsorship: requiresVisaSponsorship ?? undefined,
        searchStatus: searchStatus || undefined
      },
      preferences: {
        targetRoleTitles,
        targetDisciplines,
        remotePreference: remotePreference || undefined,
        preferredCountries,
        employmentTypes,
        relocationPreference: relocationPreference || undefined,
        minSalary: minSalary || undefined,
        maxSalary: maxSalary || undefined,
        salaryCurrency: salaryCurrency || undefined,
        salaryPeriod: salaryPeriod || undefined
      },
      // CRITICAL: Only send skills snapshot on FIT step (step === 2)
      skills: targetStep === 2 ? skills : undefined
    };
  }, [
    headline,
    experienceYears,
    seniority,
    currentCountry,
    currentCity,
    timezone,
    workAuthorizations,
    requiresVisaSponsorship,
    searchStatus,
    targetRoleTitles,
    targetDisciplines,
    remotePreference,
    preferredCountries,
    employmentTypes,
    relocationPreference,
    minSalary,
    maxSalary,
    salaryCurrency,
    salaryPeriod,
    skills,
    candidateRevision
  ]);

  const executeAutosave = useCallback(async (targetStep: number, targetRev: number) => {
    const currentRequestId = ++requestIdRef.current;
    setSaveStatus("saving");
    try {
      const payload = buildPayload(targetStep, targetRev);
      const updated = await autosaveOnboarding(payload);
      if (currentRequestId !== requestIdRef.current) return;

      setRevision(updated.progress.revision);
      if (updated.profileRevision !== undefined) {
        setCandidateRevision(updated.profileRevision);
      }
      if (updated.briefCompleteness !== undefined) {
        setBriefScore(updated.briefCompleteness);
      }
      setSaveStatus("saved");
      setConflictError(null);
      setConflictServerState(null);
    } catch (err: unknown) {
      if (currentRequestId !== requestIdRef.current) return;
      if (err instanceof ApiError && err.status === 409) {
        setSaveStatus("conflict");
        setStatusMessage("Sync conflict");
        const payload = err.payload;
        setConflictServerState(payload?.currentState ?? null);
        setConflictError(
          `Your opportunity brief was modified in another window (revision ${payload?.currentRevision ?? "latest"}). Click 'Update & Sync' to merge latest changes safely.`
        );
      } else {
        setSaveStatus("error");
        setStatusMessage("Save failed");
      }
    }
  }, [buildPayload, setSaveStatus, setStatusMessage]);

  // Debounced Autosave on user modification
  useEffect(() => {
    if (!isLoadedRef.current) return;

    if (autosaveTimerRef.current) {
      clearTimeout(autosaveTimerRef.current);
    }

    autosaveTimerRef.current = setTimeout(() => {
      void executeAutosave(step, revision);
    }, 800);

    return () => {
      if (autosaveTimerRef.current) {
        clearTimeout(autosaveTimerRef.current);
      }
    };
  }, [executeAutosave, step, revision]);

  // Register failed-save retry handler in layout
  useEffect(() => {
    setRetryAutosave(() => () => {
      void executeAutosave(step, revision);
    });
    return () => {
      setRetryAutosave(undefined);
    };
  }, [executeAutosave, setRetryAutosave, step, revision]);

  function handleResolveConflict() {
    if (!conflictServerState) {
      window.location.reload();
      return;
    }
    const data = conflictServerState;
    setRevision(data.progress.revision);
    if (data.profileRevision !== undefined) {
      setCandidateRevision(data.profileRevision);
    }
    if (data.preferences?.targetRoleTitles) setTargetRoleTitles(data.preferences.targetRoleTitles);
    if (data.preferences?.targetDisciplines) setTargetDisciplines(data.preferences.targetDisciplines);
    if (data.profile?.seniorityLevel) setSeniority(data.profile.seniorityLevel);
    if (data.profile?.searchStatus) setSearchStatus(data.profile.searchStatus);
    if (data.profile?.headline) setHeadline(data.profile.headline);

    if (data.profile?.currentCountry) setCurrentCountry(data.profile.currentCountry);
    if (data.profile?.currentCity) setCurrentCity(data.profile.currentCity);
    if (data.profile?.timezone) setTimezone(data.profile.timezone);
    if (data.profile?.workAuthorizations) setWorkAuthorizations(data.profile.workAuthorizations);
    if (data.profile?.requiresVisaSponsorship !== null && data.profile?.requiresVisaSponsorship !== undefined) {
      setRequiresVisaSponsorship(data.profile.requiresVisaSponsorship);
    }
    if (data.preferences?.remotePreference) setRemotePreference(data.preferences.remotePreference);
    if (data.preferences?.preferredCountries) setPreferredCountries(data.preferences.preferredCountries);
    if (data.preferences?.employmentTypes) setEmploymentTypes(data.preferences.employmentTypes);
    if (data.preferences?.relocationPreference) setRelocationPreference(data.preferences.relocationPreference);

    if (data.skills) setSkills(data.skills);
    if (data.profile?.experienceYears !== null && data.profile?.experienceYears !== undefined) {
      setExperienceYears(data.profile.experienceYears);
    }

    if (data.preferences?.minSalary) setMinSalary(data.preferences.minSalary);
    if (data.preferences?.maxSalary) setMaxSalary(data.preferences.maxSalary);
    if (data.preferences?.salaryCurrency) setSalaryCurrency(data.preferences.salaryCurrency);
    if (data.preferences?.salaryPeriod) setSalaryPeriod(data.preferences.salaryPeriod);

    if (data.briefCompleteness !== undefined) setBriefScore(data.briefCompleteness);

    setConflictError(null);
    setConflictServerState(null);
    setSaveStatus("saved");
  }

  function toggleArrayItem<T>(list: T[], item: T, setter: (items: T[]) => void) {
    if (list.includes(item)) {
      setter(list.filter((x) => x !== item));
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
    setTargetRoleTitles(targetRoleTitles.filter((r) => r !== role));
  }

  function toggleSkill(name: string) {
    const norm = name.trim().toLowerCase();
    const exists = skills.some((s) => s.displayName.trim().toLowerCase() === norm);
    if (exists) {
      setSkills(skills.filter((s) => s.displayName.trim().toLowerCase() !== norm));
    } else {
      setSkills([...skills, { displayName: name.trim() }]);
    }
  }

  function addCustomSkill() {
    const trimmed = newSkillInput.normalize("NFKC").trim();
    if (!trimmed) return;
    const norm = trimmed.toLowerCase();
    if (!skills.some((s) => s.displayName.trim().toLowerCase() === norm)) {
      setSkills([...skills, { displayName: trimmed }]);
      setNewSkillInput("");
    }
  }

  function removeSkill(name: string) {
    setSkills(skills.filter((s) => s.displayName !== name));
  }

  async function handleSkip() {
    isTransitioningRef.current = true;
    setIsSkipping(true);
    try {
      await skipOnboarding({ expectedRevision: revision });
      updateOnboardingStatus("SKIPPED");
      startTransition(() => {
        navigate(returnTo, { replace: true });
      });
    } catch (err: unknown) {
      isTransitioningRef.current = false;
      setIsSkipping(false);
      if (err instanceof ApiError && err.status === 409) {
        setConflictServerState(err.payload?.currentState ?? null);
        setConflictError("Your opportunity brief was modified in another session. Click 'Update & Sync' to reconcile.");
      }
    }
  }

  async function handleComplete() {
    isTransitioningRef.current = true;
    setIsSubmitting(true);
    try {
      await completeOnboarding({ expectedRevision: revision });
      updateOnboardingStatus("COMPLETED");
      startTransition(() => {
        navigate(returnTo, { replace: true });
      });
    } catch (err: unknown) {
      isTransitioningRef.current = false;
      setIsSubmitting(false);
      if (err instanceof ApiError && err.status === 409) {
        setConflictServerState(err.payload?.currentState ?? null);
        setConflictError("Your opportunity brief was modified in another session. Click 'Update & Sync' to reconcile.");
      }
    }
  }

  const handleNext = () => {
    if (step < 3) {
      const nextStep = step + 1;
      setStep(nextStep);
      if (autosaveTimerRef.current) {
        clearTimeout(autosaveTimerRef.current);
      }
      void executeAutosave(nextStep, revision);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } else {
      void handleComplete();
    }
  };

  const handleBack = () => {
    if (step > 0) {
      const prevStep = step - 1;
      setStep(prevStep);
      if (autosaveTimerRef.current) {
        clearTimeout(autosaveTimerRef.current);
      }
      void executeAutosave(prevStep, revision);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };


  if (loading) {
    return (
      <div className="w-full flex-1 flex flex-col items-center justify-center py-24">
        <div className="flex flex-col items-center gap-3">
          <Loader2 size={24} className="animate-spin text-indigo" />
          <span className="text-xs font-mono uppercase tracking-widest text-slate">
            Loading opportunity brief…
          </span>
        </div>
      </div>
    );
  }

  if (initError) {
    return (
      <div className="w-full flex-1 flex flex-col items-center justify-center p-6 text-center">
        <div className="max-w-md w-full rounded-[var(--radius-card)] border border-line bg-white p-8 shadow-sm">
          <h2 className="text-lg font-semibold text-ink">Could not load onboarding</h2>
          <p className="mt-2 text-sm text-slate">{initError}</p>
          <div className="mt-6 flex justify-center">
            <Button
              onClick={() => window.location.reload()}
              variant="secondary"
              icon={<RefreshCw size={14} />}
            >
              Reload Page
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full flex-1 flex flex-col items-center py-8 px-4 sm:px-6">
      <div className="w-full max-w-3xl">
        {/* Step Progress Bar */}
        <div className="mb-8 flex items-center justify-between">
          <ol className="flex items-center gap-2 grow max-w-xl">
            {stepDisplayNames.map((name, i) => (
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
          <div className="mb-6 rounded-[var(--radius-card)] border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs">
            <div className="flex items-start gap-2.5">
              <RefreshCw size={16} className="text-amber-700 shrink-0 mt-0.5" />
              <p>{conflictError}</p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Button
                onClick={handleResolveConflict}
                variant="primary"
                size="sm"
                icon={<RefreshCw size={13} />}
              >
                Update & Sync
              </Button>
            </div>
          </div>
        )}

        {/* Step Card */}
        <div className="rounded-[var(--radius-feature)] border border-line bg-white p-5 sm:p-10 shadow-sm">
          {/* STEP 0: GOAL */}
          {step === 0 && (
            <Section
              kicker="Step 1 of 4 · Career Goal"
              title="What roles are you targeting?"
              desc="RoleBrief uses your target titles and disciplines to compute Match Briefs and rank your personalized Radar."
            >
              <Field label="Target Role Titles">
                <div className="space-y-3">
                  {targetRoleTitles.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {targetRoleTitles.map((role) => (
                        <span
                          key={role}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[var(--radius-pill)] bg-indigo-tint/50 border border-indigo/20 text-xs font-medium text-ink"
                        >
                          {role}
                          <button
                            type="button"
                            onClick={() => removeTargetRole(role)}
                            className="text-slate hover:text-rose-600 transition-colors cursor-pointer"
                          >
                            <X size={12} />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}

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

              <div className="grid sm:grid-cols-2 gap-5">
                <Field label="Target Seniority Level">
                  <select
                    value={seniority ?? ""}
                    onChange={(e) => setSeniority(e.target.value ? (e.target.value as SeniorityLevel) : null)}
                    className="w-full rounded-[var(--radius-control)] border border-line bg-white px-3 py-2 text-sm text-ink focus:outline-hidden focus:ring-2 focus:ring-indigo/20 focus:border-indigo"
                  >
                    <option value="">Select seniority…</option>
                    {SENIORITY_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </Field>

                <Field label="Search Status">
                  <SegmentedControl
                    value={searchStatus ?? ""}
                    onChange={(v) => setSearchStatus(v ? (v as CandidateSearchStatus) : null)}
                    options={[
                      { value: "ACTIVELY_LOOKING", label: "Active" },
                      { value: "OPEN_TO_OFFERS", label: "Open" },
                      { value: "CASUAL", label: "Casual" },
                      { value: "NOT_LOOKING", label: "Not looking" }
                    ]}
                  />
                </Field>
              </div>

              <Field label="Professional Headline">
                <Input
                  value={headline}
                  onChange={(e) => setHeadline(e.target.value)}
                  placeholder="e.g. Staff Infrastructure Engineer · Distributed Systems"
                  maxLength={140}
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
                <Field label="Current Base Country (ISO-2)">
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
                </Field>

                <Field label="Current City (Optional)">
                  <Input
                    placeholder="e.g. San Francisco or London"
                    value={currentCity}
                    onChange={(e) => setCurrentCity(e.target.value)}
                  />
                </Field>
              </div>

              <div className="grid sm:grid-cols-2 gap-5">
                <Field label="Remote Work Mode">
                  <SegmentedControl
                    value={remotePreference ?? ""}
                    onChange={(v) => setRemotePreference(v ? (v as RemotePreference) : null)}
                    options={[
                      { value: "REMOTE_ONLY", label: "Remote Only" },
                      { value: "HYBRID", label: "Hybrid" },
                      { value: "ONSITE", label: "On-site" },
                      { value: "OPEN_TO_ANY", label: "Open to Any" }
                    ]}
                  />
                </Field>

                <Field label="Employer Visa Sponsorship">
                  <select
                    value={requiresVisaSponsorship === null ? "" : requiresVisaSponsorship ? "YES" : "NO"}
                    onChange={(e) => {
                      const v = e.target.value;
                      setRequiresVisaSponsorship(v === "YES" ? true : v === "NO" ? false : null);
                    }}
                    className="w-full rounded-[var(--radius-control)] border border-line bg-white px-3 py-2 text-sm text-ink focus:outline-hidden focus:ring-2 focus:ring-indigo/20 focus:border-indigo"
                  >
                    <option value="">Not declared</option>
                    <option value="NO">No sponsorship needed</option>
                    <option value="YES">Requires sponsorship</option>
                  </select>
                </Field>
              </div>

              <Field label="Work Authorization Countries (No Sponsorship Needed)">
                <p className="text-xs text-slate mb-2">Select all countries where you hold legal right to work without employer sponsorship.</p>
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

              <div className="grid sm:grid-cols-2 gap-5">
                <Field label="Employment Types Accepted">
                  <div className="flex flex-wrap gap-2">
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
                </Field>

                <Field label="Relocation Preference">
                  <SegmentedControl
                    value={relocationPreference ?? ""}
                    onChange={(v) => setRelocationPreference(v ? (v as RelocationPreference) : null)}
                    options={[
                      { value: "NOT_OPEN", label: "No Relocation" },
                      { value: "WILLING_TO_RELOCATE", label: "Willing" },
                      { value: "OPEN_TO_REMOTE_ONLY", label: "Remote Only" }
                    ]}
                  />
                </Field>
              </div>
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
                  {skills.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {skills.map((s) => (
                        <span
                          key={s.displayName}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[var(--radius-pill)] bg-indigo-tint/50 border border-indigo/20 text-xs font-medium text-ink"
                        >
                          {s.displayName}
                          <button
                            type="button"
                            onClick={() => removeSkill(s.displayName)}
                            className="text-slate hover:text-rose-600 transition-colors cursor-pointer"
                          >
                            <X size={12} />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}

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
                    value={experienceYears ?? ""}
                    onChange={(e) => setExperienceYears(parseInt(e.target.value, 10) || null)}
                    placeholder="e.g. 5"
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
              {/* Brief Completeness Progress Gauge */}
              <div className="rounded-[var(--radius-card)] border border-line bg-paper/40 p-4 mb-2">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-mono uppercase tracking-wider text-slate">Opportunity Brief Completeness</span>
                  <span className="text-xs font-mono font-bold text-ink">{briefScore}%</span>
                </div>
                <div className="h-2 rounded-full bg-line/60 overflow-hidden">
                  <div
                    className="h-full bg-indigo transition-all duration-500 rounded-full"
                    style={{ width: `${briefScore}%` }}
                  />
                </div>
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <ReviewRow label="Target Roles" value={targetRoleTitles.join(", ") || "None specified"} />
                <ReviewRow label="Seniority & Headline" value={`${seniority ?? "Not specified"} · ${headline || "No headline"}`} />
                <ReviewRow label="Primary Discipline" value={targetDisciplines.join(", ") || "None selected"} />
                <ReviewRow label="Base Location" value={`${currentCity ? `${currentCity}, ` : ""}${currentCountry || "Not specified"}`} />
                <ReviewRow label="Remote Scope" value={remotePreference ? remotePreference.replace(/_/g, " ") : "Not specified"} />
                <ReviewRow label="Authorized Countries" value={workAuthorizations.join(", ") || "None specified"} />
                <ReviewRow label="Skills" value={skills.map((s) => s.displayName).join(", ") || "None added"} />
                <ReviewRow label="Experience" value={experienceYears !== null ? `${experienceYears} years` : "Not specified"} />
              </div>

              <div className="pt-2 border-t border-line space-y-4">
                <div className="grid sm:grid-cols-4 gap-4">
                  <Field label="Minimum Base Salary">
                    <Input
                      type="number"
                      step={5000}
                      value={minSalary ?? ""}
                      onChange={(e) => setMinSalary(parseInt(e.target.value, 10) || undefined)}
                      placeholder="e.g. 120000"
                    />
                  </Field>
                  <Field label="Target Base Salary">
                    <Input
                      type="number"
                      step={5000}
                      value={maxSalary ?? ""}
                      onChange={(e) => setMaxSalary(parseInt(e.target.value, 10) || undefined)}
                      placeholder="e.g. 160000"
                    />
                  </Field>
                  <Field label="Currency">
                    <select
                      value={salaryCurrency ?? ""}
                      onChange={(e) => setSalaryCurrency(e.target.value || null)}
                      className="w-full rounded-[var(--radius-control)] border border-line bg-white px-3 py-2 text-sm text-ink focus:outline-hidden focus:ring-2 focus:ring-indigo/20 focus:border-indigo"
                    >
                      <option value="">Select currency…</option>
                      <option value="USD">USD ($)</option>
                      <option value="EUR">EUR (€)</option>
                      <option value="GBP">GBP (£)</option>
                      <option value="CAD">CAD ($)</option>
                    </select>
                  </Field>
                  <Field label="Period">
                    <select
                      value={salaryPeriod ?? "ANNUAL"}
                      onChange={(e) => setSalaryPeriod((e.target.value as SalaryPeriod) || null)}
                      className="w-full rounded-[var(--radius-control)] border border-line bg-white px-3 py-2 text-sm text-ink focus:outline-hidden focus:ring-2 focus:ring-indigo/20 focus:border-indigo"
                    >
                      <option value="ANNUAL">Annual (/ yr)</option>
                      <option value="MONTHLY">Monthly (/ mo)</option>
                      <option value="HOURLY">Hourly (/ hr)</option>
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
