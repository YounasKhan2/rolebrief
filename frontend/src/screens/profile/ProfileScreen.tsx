import { useEffect, useState } from "react";
import { Link } from "react-router";
import { FileText, Pencil, ShieldCheck, Lock, RefreshCw, Loader2 } from "lucide-react";
import { PageContainer, PageHeader } from "../../components/shell/AppShell";
import { Kicker, Badge, Button, SectionRule } from "../../components/ui/primitives";
import { useOnboarding } from "../../components/auth/OnboardingGate";
import { getProfile, ProfileState } from "../../lib/onboarding-api";

export function Component() {
  const { state: onboardingState, refresh: refreshOnboardingState } = useOnboarding();
  const [profileData, setProfileData] = useState<ProfileState | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        const res = await getProfile();
        if (mounted) setProfileData(res);
      } catch {
        // Fallback to gate state if direct endpoint fails
        if (mounted && onboardingState) {
          setProfileData({
            profile: onboardingState.profile,
            preferences: onboardingState.preferences,
            skills: onboardingState.skills,
            completeness: onboardingState.completeness,
            breakdown: onboardingState.breakdown
          });
        }
      } finally {
        if (mounted) setLoading(false);
      }
    }
    void load();
    return () => {
      mounted = false;
    };
  }, [onboardingState]);

  const profile = profileData?.profile ?? onboardingState?.profile;
  const preferences = profileData?.preferences ?? onboardingState?.preferences;
  const skills = profileData?.skills ?? onboardingState?.skills ?? [];
  const completeness = profileData?.completeness ?? onboardingState?.completeness ?? 0;

  const fields = [
    {
      label: "Target roles",
      value: preferences?.targetRoleTitles?.length
        ? preferences.targetRoleTitles.join(", ")
        : "Not set"
    },
    {
      label: "Seniority & Experience",
      value: profile?.seniorityLevel
        ? `${profile.seniorityLevel} · ${profile.experienceYears ?? 0} yrs experience`
        : "Not set"
    },
    {
      label: "Primary discipline",
      value: preferences?.targetDisciplines?.length
        ? preferences.targetDisciplines.join(", ")
        : profile?.primaryDiscipline || "Not set"
    },
    {
      label: "Headline",
      value: profile?.headline || "Not set"
    },
    {
      label: "Current location",
      value: profile?.currentCountry
        ? `${profile.currentCity ? `${profile.currentCity}, ` : ""}${profile.currentCountry}`
        : "Not set"
    },
    {
      label: "Remote preference",
      value: preferences?.remotePreference
        ? preferences.remotePreference.replace(/_/g, " ")
        : "Open to any"
    },
    {
      label: "Work authorizations",
      value: profile?.workAuthorizations?.length
        ? profile.workAuthorizations.join(", ")
        : "Not specified"
    },
    {
      label: "Preferred target countries",
      value: preferences?.preferredCountries?.length
        ? preferences.preferredCountries.join(", ")
        : "Not specified"
    },
    {
      label: "Skills",
      value: skills.length
        ? skills.map((s) => s.displayName).join(", ")
        : "None added yet"
    },
    {
      label: "Salary preference",
      value: preferences?.minSalary
        ? `${preferences.salaryCurrency ?? "USD"} ${preferences.minSalary.toLocaleString()}${
            preferences.maxSalary ? ` – ${preferences.maxSalary.toLocaleString()}` : "+"
          }`
        : "Not disclosed"
    }
  ];

  if (loading && !profileData && !onboardingState) {
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
          <Link to="/app/onboarding?edit=true">
            <Button variant="secondary" icon={<Pencil size={15} />}>
              Update opportunity brief
            </Button>
          </Link>
        }
      />

      {/* Completeness Gauge */}
      <div className="rounded-[var(--radius-card)] border border-line bg-white p-6 mb-6 shadow-xs">
        <div className="flex items-center justify-between mb-2">
          <Kicker className="font-mono text-xs">Profile completeness</Kicker>
          <span className="font-data text-sm font-semibold text-ink">{completeness}%</span>
        </div>
        <div className="h-2 rounded-full bg-line/60 overflow-hidden">
          <div
            className="h-full bg-indigo transition-all duration-500 rounded-full"
            style={{ width: `${completeness}%` }}
          />
        </div>
        <p className="text-xs text-slate mt-2.5">
          {completeness >= 80
            ? "Your opportunity brief is comprehensive and powers accurate Match Briefs."
            : "Complete your skills, location, and salary preferences to unlock maximum match fidelity."}
        </p>
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

          <Link to="/app/onboarding?edit=true">
            <Button variant="tertiary" size="sm" icon={<Pencil size={13} />}>
              Edit brief directly
            </Button>
          </Link>
        </div>
      </div>
    </PageContainer>
  );
}
