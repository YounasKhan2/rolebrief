import { useParams, Link, useLocation } from "react-router";
import {
  ExternalLink,
  Bookmark,
  BookmarkCheck,
  ListChecks,
  Check,
  Flag,
  ShieldAlert,
  ChevronRight,
  AlertTriangle,
} from "lucide-react";
import { PageContainer } from "../../shared/shell/AppShell";
import { Button, Kicker, Badge, CompanyLogo, SourceBadge, SectionRule, EmptyState, Skeleton } from "../../ui/primitives";
import { EligibilityShield } from "../../shared/rolebrief/EligibilityShield";
import { MatchBrief } from "../../shared/rolebrief/MatchBrief";
import { FreshnessTimeline } from "../../shared/rolebrief/FreshnessTimeline";
import { JobMetaRow, ReasonChips } from "../../shared/rolebrief/JobCard";
import { JobCard } from "../../shared/rolebrief/JobCard";
import { useJob, useSimilarJobs } from "../../lib/jobs/jobs";
import { domainFromUrl } from "../../lib/core/format";
import { useToast } from "../../ui/toast";
import { useAuthGate } from "../auth/components/AuthGateDialog";
import { useSaved } from "../../lib/features/saved-context";
import { useTracker } from "../../lib/features/tracker-context";
import { useAuth } from "../../lib/auth/auth";
import { useJobEligibility } from "../../lib/jobs/eligibility";
import { fetchMatchBriefDetail, type MatchBriefDetail } from "../../lib/jobs/match-briefs";
import { useEffect, useState } from "react";
import CandidateJobCard from "../../shared/candidate/CandidateJobCard";
import { evidenceItems } from "../../shared/candidate/radar-presentation";
import "./candidate-job-detail.css";

export function Component() {
  const { slug } = useParams();
  const location = useLocation();
  const candidate = location.pathname.startsWith("/app/");
  const jobsPath = location.pathname.startsWith("/app") ? "/app/jobs" : "/jobs";
  const toast = useToast();
  const authGate = useAuthGate();
  const savedContext = useSaved();
  const trackerContext = useTracker();
  const auth = useAuth();
  const { isAuthenticated, isAdmin } = auth;
  const { result: eligibilityResult } = useJobEligibility(slug, isAuthenticated && !isAdmin);
  const { data: job, loading, error, notFound, retry } = useJob(slug);
  const similar = useSimilarJobs(job, 6);
  const [matchDetail, setMatchDetail] = useState<MatchBriefDetail | null>(null);
  const [matchError, setMatchError] = useState<string | null>(null);
  const [matchAttempt, setMatchAttempt] = useState(0);

  useEffect(() => {
    if (!slug || !isAuthenticated || isAdmin) {
      setMatchDetail(null);
      setMatchError(null);
      return;
    }
    const controller = new AbortController();
    setMatchDetail(null);
    setMatchError(null);
    fetchMatchBriefDetail(slug, controller.signal)
      .then(setMatchDetail)
      .catch((err) => {
        if (controller.signal.aborted) return;
        setMatchError(err instanceof Error ? err.message : "Could not load Match Brief.");
      });
    return () => controller.abort();
  }, [slug, isAuthenticated, isAdmin, matchAttempt]);

  const isSaved = job ? savedContext.isSaved(job.slug) : false;
  const isPending = job ? savedContext.isPending(job.slug) : false;
  const isJobTracked = job ? trackerContext.isTracked(job.slug) : false;
  const isTrackerPending = job ? trackerContext.isPending(job.slug) : false;

  const handleToggleSave = () => {
    if (!job) return;
    try {
      sessionStorage.setItem("rb_intent_save_slug", job.slug);
    } catch {}
    authGate.gate({
      action: "save this role",
      onAuthenticated: () => {
        try {
          sessionStorage.removeItem("rb_intent_save_slug");
        } catch {}
        void savedContext.toggleSave(job.slug);
      }
    });
  };

  const handleTrack = () => {
    if (!job) return;
    authGate.gate({
      action: "track this role",
      onAuthenticated: () => {
        void trackerContext.trackJob(job.slug);
      }
    });
  };

  if (loading) {
    return (
      <PageContainer className={candidate ? "candidate-detail detail-loading" : undefined}>
        <div className="grid lg:grid-cols-[1fr_336px] gap-8 lg:gap-12">
          <div className="space-y-5">
            <Skeleton className="h-5 w-80" />
            <Skeleton className="h-16 w-full max-w-3xl" />
            <Skeleton className="h-5 w-2/3" />
            <SectionRule className="my-8" />
            <Skeleton className="h-40 w-full" />
            <Skeleton className="h-32 w-full" />
          </div>
          <div className="hidden lg:block space-y-5">
            <Skeleton className="h-56 w-full rounded-[var(--radius-feature)]" />
            <Skeleton className="h-44 w-full rounded-[var(--radius-card)]" />
          </div>
        </div>
      </PageContainer>
    );
  }

  if (!job && notFound) {
    return (
      <PageContainer className={candidate ? "candidate-detail" : undefined}>
        <EmptyState title="Role not found" body="This listing may have expired or moved." action={<Link to={jobsPath} className="text-indigo font-medium">Back to jobs</Link>} />
      </PageContainer>
    );
  }

  if (!job || error) {
    return (
      <PageContainer className={candidate ? "candidate-detail" : undefined}>
        <EmptyState title="Could not load this role" body={error?.message ?? "The jobs API did not return a role."} action={<Button variant="secondary" onClick={retry}>Retry</Button>} />
      </PageContainer>
    );
  }

  const availability = eligibilityResult?.jobAvailability;
  const expired =
    job.flags?.includes("expired") ||
    availability?.status === "EXPIRED" ||
    availability?.status === "DELISTED" ||
    Boolean(eligibilityResult?.isJobExpired);
  const canApply = availability ? availability.canApply : (!expired && Boolean(job.applyUrl));
  const domain = job.applyDomain || domainFromUrl(job.applyUrl);
  const suspicious = Boolean(job.applyUrl && domain === "unknown");
  const isProviderDomain = domain.toLowerCase().includes("himalayas.app");
  const ctaLabel = expired
    ? "Listing expired"
    : !canApply
      ? (availability?.reason || "Application unavailable")
      : isProviderDomain
        ? "Apply on Himalayas"
        : "Apply on company site";

  const applyBar = (
    <>
      <Button
        variant="secondary"
        onClick={handleToggleSave}
        disabled={isPending}
        aria-busy={isPending ? "true" : "false"}
        icon={isSaved ? <BookmarkCheck size={16} className="text-indigo" /> : <Bookmark size={16} />}
      >
        {isSaved ? "Saved" : "Save"}
      </Button>
      {isJobTracked ? (
        <Link to="/app/tracker">
          <Button variant="secondary" icon={<Check size={16} className="text-emerald" />}>
            Tracked
          </Button>
        </Link>
      ) : (
        <Button
          variant="secondary"
          onClick={handleTrack}
          disabled={isTrackerPending}
          aria-busy={isTrackerPending ? "true" : "false"}
          icon={<ListChecks size={16} />}
        >
          Track
        </Button>
      )}
      {!canApply ? (
        <span className="grow inline-flex items-center justify-center gap-2 h-11 px-4 rounded-[var(--radius-control)] bg-slate/20 text-slate font-medium cursor-not-allowed text-sm">
          <AlertTriangle size={16} /> {ctaLabel}
        </span>
      ) : (
        <a
          href={job.applyUrl}
          target="_blank"
          rel="noreferrer"
          className="grow inline-flex items-center justify-center gap-2 h-11 px-4 rounded-[var(--radius-control)] bg-indigo text-white font-medium hover:bg-indigo-strong transition-colors"
        >
          {ctaLabel} <ExternalLink size={16} />
        </a>
      )}
    </>
  );

  if (candidate) {
    const timestamp = (kind: string) => {
      const event = job.freshness.find((item) => item.kind === kind);
      if (!event || !Number.isFinite(Date.parse(event.at))) return "Not listed";
      return new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(new Date(event.at));
    };
    const facts = [
      ["Company", job.companyName],
      ["Work mode", job.workModel],
      ["Location", job.locations.join(" · ")],
      ["Employment", job.employmentType],
      ["Seniority", job.seniority],
      ["Salary", job.salary?.provided ? job.salary.text : "Not disclosed"],
      ["Posted", timestamp("published")],
      ["First seen", timestamp("discovered")],
      ["Employer deadline", timestamp("deadline")],
      ["Source", job.source],
      ["Status", expired ? "Expired or delisted" : job.flags?.includes("suspicious") ? "Check required" : "Active"],
    ];
    return (
      <div className="candidate-detail">
        <nav className="detail-breadcrumb" aria-label="Breadcrumb">
          <Link to={jobsPath}><span className="detail-mobile-back">← Back to </span>Jobs</Link>
          <ChevronRight size={12} /><span>{job.companyName}</span>
          <ChevronRight size={12} /><span aria-current="page">{job.title}</span>
        </nav>
        <header className="detail-header">
          <CompanyLogo name={job.companyName} size={44} />
          <div><p className="detail-eyebrow">{job.companyName}</p><h1>{job.title}</h1>
            <JobMetaRow job={job} />
          </div>
        </header>
        {(expired || suspicious || job.flags?.includes("suspicious")) && <p className="detail-warning" role="status"><ShieldAlert size={17} />{expired ? "This role is expired or delisted. Applications are unavailable." : "Review this listing and its destination before sharing personal information."}</p>}
        <div className="detail-workspace">
          <article className="detail-reading">
            <section className="detail-evidence" aria-label="Role evidence">
              <div className="detail-match"><h2>Match Brief</h2>
                <MatchBrief data={{ ...job.match, summary: matchDetail ?? undefined, detail: matchDetail }} variant="full" />
                {matchError && <div role="status"><p>{matchError}</p><Button variant="secondary" onClick={() => setMatchAttempt((value) => value + 1)}>Retry Match Brief</Button></div>}
              </div>
              <div className="detail-eligibility"><h2>Eligibility Shield</h2>
                <EligibilityShield detail={eligibilityResult} state={job.eligibility.state} reasons={job.eligibility.reasons} isJobExpired={expired} variant="detail" />
              </div>
            </section>
            <section className="detail-description"><h2>About the role</h2>
              {job.description.html ? <div className="job-description" dangerouslySetInnerHTML={{ __html: job.description.html }} /> : <p>{job.description.overview || "A description was not provided by the source."}</p>}
            </section>
            <section className="detail-restrictions"><h2>Work authorization & location requirements</h2><p>{job.remoteRestrictionsText || job.description.workAuthorization || "Not provided. Confirm requirements with the employer."}</p></section>
            <section className="detail-disclosure"><h2>Source & disclosure</h2><p>Indexed from {job.source}. {canApply ? `Applications open on ${domain}.` : "Applications are currently unavailable."} RoleBrief does not determine hiring outcomes.</p>{job.sourceUrl && <a href={job.sourceUrl} target="_blank" rel="noreferrer">View original listing <ExternalLink size={12} /></a>}</section>
            <div className="mt-10"><h2 className="text-lg font-semibold text-ink mb-4">Related company news</h2><EmptyState title="Company news unavailable" body="News ingestion is still demo-only and is not mixed into real provider jobs." /></div>
            {similar.data.length > 0 && <section className="detail-related"><h2>Similar stored roles</h2>{similar.data.map((item) => <CandidateJobCard key={item.slug} job={item} />)}</section>}
          </article>
          <aside className="detail-rail" aria-label="Role decision and job facts">
            <section className="detail-actions"><h2>Your next step</h2><div className="detail-action-controls">{applyBar}</div><p>{canApply ? <>Opens <strong>{domain}</strong> in a new tab.</> : availability?.reason || "No active application link is available."}</p></section>
            <section className="detail-rail-match"><h2>Match Brief</h2><strong>{matchDetail?.label || "Not calculated"}</strong><ul>{evidenceItems(matchDetail ?? undefined).map((item, index) => <li key={index}>{item.label}</li>)}</ul><p>Evidence-based alignment, not hiring probability.</p></section>
            <section className="detail-rail-eligibility"><h2>Eligibility Shield</h2><strong>{eligibilityResult?.badgeText || "Check required"}</strong><p>{eligibilityResult?.headline || "Eligibility evidence is unavailable. Confirm requirements with the employer."}</p></section>
            <section className="detail-facts"><h2>Job facts</h2><dl>{facts.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value || "Not listed"}</dd></div>)}</dl></section>
          </aside>
        </div>
      </div>
    );
  }

  return (
    <>
      <PageContainer className="pb-28 md:pb-8">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-1.5 text-[13px] text-slate mb-6" aria-label="Breadcrumb">
          <Link to={jobsPath} className="hover:text-ink">Jobs</Link>
          <ChevronRight size={13} />
          <span className="hover:text-ink">{job.companyName}</span>
          <ChevronRight size={13} />
          <span className="text-ink truncate">{job.title}</span>
        </nav>

        {expired && (
          <div className="mb-5 rounded-[var(--radius-card)] border border-amber/30 bg-amber-tint p-4 flex items-start gap-3">
            <ShieldAlert size={18} className="text-amber mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-medium text-ink">This listing has expired.</p>
              <p className="text-[13px] text-slate">This job has expired or reached its deadline. See similar active roles below.</p>
            </div>
          </div>
        )}
        {suspicious && (
          <div className="mb-5 rounded-[var(--radius-card)] border border-red/30 bg-red-tint p-4 text-sm text-ink">
            The destination link looks unusual. Confirm the domain before entering any details.
          </div>
        )}

        <div className="grid lg:grid-cols-[1fr_336px] gap-8 lg:gap-12 items-start">
          {/* Reading column */}
          <article>
            <header>
              <div className="flex items-start gap-4">
                <CompanyLogo name={job.companyName} size={52} />
                <div>
                  <Kicker className="mb-2">{job.discipline} · {job.employmentType}</Kicker>
                  <h1 className="font-display text-3xl sm:text-[40px] leading-tight text-navy">{job.title}</h1>
                </div>
              </div>
              <div className="mt-4">
                <JobMetaRow job={job} />
              </div>
              <div className="mt-4">
                <ReasonChips reasons={job.reasons} />
              </div>
              <div className="mt-4 flex items-center gap-4">
                <SourceBadge source={job.source} domain={domainFromUrl(job.sourceUrl)} />
                <a href={job.sourceUrl} target="_blank" rel="noreferrer" className="text-[13px] text-cyan hover:underline inline-flex items-center gap-1">
                  View original <ExternalLink size={12} />
                </a>
              </div>
            </header>

            <SectionRule className="my-8" />

            <Section title={job.description.html ? "Description" : "About the role"}>
              {job.description.html ? (
                <div
                  className="text-ink/85 reading-measure job-description prose max-w-none space-y-4 [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:text-ink [&_h2]:mt-6 [&_h2]:mb-2 [&_h3]:text-lg [&_h3]:font-semibold [&_h3]:text-ink [&_h3]:mt-4 [&_h3]:mb-1.5 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-1.5 [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:space-y-1.5 [&_p]:leading-relaxed [&_a]:text-indigo [&_a]:underline"
                  dangerouslySetInnerHTML={{ __html: job.description.html }}
                />
              ) : (
                <p className="text-ink/85 reading-measure leading-relaxed">{job.description.overview}</p>
              )}
            </Section>
            <Section title="Work authorization & location requirements">
              <p className="text-ink/85 reading-measure">{job.remoteRestrictionsText || job.description.workAuthorization}</p>
            </Section>

            <SectionRule className="my-8" />

            {/* Full Match Brief */}
            <div className="rounded-[var(--radius-feature)] border border-line bg-soft/60 p-6">
              <MatchBrief
                data={{
                  ...job.match,
                  summary: matchDetail ?? undefined,
                  detail: matchDetail
                }}
                variant="full"
              />
              {matchError && <p className="mt-3 text-[13px] text-amber">{matchError}</p>}
            </div>

            {/* Source disclosure */}
            <div className="mt-6 rounded-[var(--radius-card)] border border-line p-4">
              <Kicker className="mb-2">Source & disclosure</Kicker>
              <p className="text-[13px] text-slate">
                RoleBrief indexed this role from <span className="text-ink">{job.source}</span> and links you to the
                destination (<span className="font-data text-ink">{domain}</span>) to apply. We do not charge employers for ranking.
              </p>
            </div>

            <div className="mt-10">
              <h2 className="text-lg font-semibold text-ink mb-4">Related company news</h2>
              <EmptyState title="Company news unavailable" body="News ingestion is still demo-only and is not mixed into real provider jobs." />
            </div>

            {similar.data.length > 0 && (
              <div className="mt-10">
                <h2 className="text-lg font-semibold text-ink mb-4">Similar stored roles</h2>
                <div className="space-y-4">
                  {similar.data.map((j) => <JobCard key={j.slug} job={j} variant="compact" />)}
                </div>
              </div>
            )}
          </article>

          {/* Sticky decision rail (desktop) */}
          <aside className="hidden lg:block lg:sticky lg:top-20 space-y-5">
            <div className="rounded-[var(--radius-feature)] border border-line bg-white p-5 shadow-[var(--shadow-raised)]">
              <div className="flex flex-col gap-2.5">{applyBar}</div>
              <p className="text-[12px] text-slate mt-3 text-center">
                Applying takes you to <span className="font-data text-ink">{domain}</span>
              </p>
            </div>
            <div className="rounded-[var(--radius-card)] border border-line p-5">
              <Kicker className="mb-3">Eligibility Shield</Kicker>
              <EligibilityShield
                detail={eligibilityResult}
                state={job.eligibility.state}
                reasons={job.eligibility.reasons}
                isJobExpired={expired}
                variant="detail"
              />
            </div>
            <div className="rounded-[var(--radius-card)] border border-line p-5">
              <Kicker className="mb-3">Freshness</Kicker>
              <FreshnessTimeline events={job.freshness} variant="expanded" />
            </div>
            <div className="rounded-[var(--radius-card)] border border-line p-5">
              <Kicker className="mb-2">About {job.companyName}</Kicker>
              <div className="flex items-center gap-2 mb-2">
                <Badge tone="slate">Company profile unavailable</Badge>
              </div>
              <p className="text-[13px] text-slate">Company momentum is incomplete because news and company enrichment are not connected to real provider data yet.</p>
            </div>
            <button onClick={() => toast({ kind: "warning", message: "Thanks — we'll review this listing." })} className="inline-flex items-center gap-1.5 text-[13px] text-slate hover:text-red px-1">
              <Flag size={14} /> Report this job
            </button>
          </aside>
        </div>
      </PageContainer>

      {/* Mobile: eligibility + safe-area apply bar */}
      <div className="lg:hidden">
        <div
          className="fixed bottom-16 inset-x-0 z-40 bg-white border-t border-line p-3 flex gap-2"
          style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 12px)" }}
        >
          {applyBar}
        </div>
      </div>
    </>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-7">
      <h2 className="text-lg font-semibold text-ink mb-2.5">{title}</h2>
      {children}
    </section>
  );
}
