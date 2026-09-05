import { useParams, Link } from "react-router";
import {
  ExternalLink,
  Bookmark,
  ListChecks,
  Flag,
  ShieldAlert,
  ChevronRight,
} from "lucide-react";
import { PageContainer } from "../../components/shell/AppShell";
import { Button, Kicker, Badge, CompanyLogo, SourceBadge, SectionRule, EmptyState, Skeleton } from "../../components/ui/primitives";
import { EligibilityShield } from "../../components/rolebrief/EligibilityShield";
import { MatchBrief } from "../../components/rolebrief/MatchBrief";
import { FreshnessTimeline } from "../../components/rolebrief/FreshnessTimeline";
import { JobMetaRow, ReasonChips } from "../../components/rolebrief/JobCard";
import { JobCard } from "../../components/rolebrief/JobCard";
import { useJob, useSimilarJobs } from "../../lib/jobs";
import { domainFromUrl } from "../../lib/format";
import { useToast } from "../../components/ui/toast";
import { useAuthGate } from "../../components/auth/AuthGateDialog";

export function Component() {
  const { slug } = useParams();
  const toast = useToast();
  const authGate = useAuthGate();
  const { data: job, loading, error, notFound, retry } = useJob(slug);
  const similar = useSimilarJobs(job);

  if (loading) {
    return (
      <PageContainer>
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
      <PageContainer>
        <EmptyState title="Role not found" body="This listing may have expired or moved." action={<Link to="/jobs" className="text-indigo font-medium">Back to jobs</Link>} />
      </PageContainer>
    );
  }

  if (!job || error) {
    return (
      <PageContainer>
        <EmptyState title="Could not load this role" body={error?.message ?? "The jobs API did not return a role."} action={<Button variant="secondary" onClick={retry}>Retry</Button>} />
      </PageContainer>
    );
  }

  const expired = job.flags?.includes("expired");
  const suspicious = job.flags?.includes("suspicious");
  const domain = domainFromUrl(job.applyUrl);

  const applyBar = (
    <>
      <Button
        variant="secondary"
        onClick={() => authGate.gate({ action: "save this role", onAuthenticated: () => toast({ kind: "info", message: "Saving jobs is unavailable until the next phase." }) })}
        icon={<Bookmark size={16} />}
      >
        Save
      </Button>
      <Button variant="secondary" onClick={() => toast({ kind: "info", message: "Tracker persistence is unavailable until a later phase." })} icon={<ListChecks size={16} />}>
        Track
      </Button>
      <a
        href={job.applyUrl}
        target="_blank"
        rel="noreferrer"
        className="grow inline-flex items-center justify-center gap-2 h-11 px-4 rounded-[var(--radius-control)] bg-indigo text-white font-medium hover:bg-indigo-strong transition-colors"
      >
        Apply on company site <ExternalLink size={16} />
      </a>
    </>
  );

  return (
    <>
      <PageContainer className="pb-28 md:pb-8">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-1.5 text-[13px] text-slate mb-6" aria-label="Breadcrumb">
          <Link to="/jobs" className="hover:text-ink">Jobs</Link>
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
              <p className="text-[13px] text-slate">It was removed from the source on 30 August. See similar eligible roles below.</p>
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
                <div className="text-ink/85 reading-measure job-description" dangerouslySetInnerHTML={{ __html: job.description.html }} />
              ) : (
                <p className="text-ink/85 reading-measure">{job.description.overview}</p>
              )}
            </Section>
            <Section title="Work authorization">
              <p className="text-ink/85 reading-measure">{job.description.workAuthorization}</p>
            </Section>

            <SectionRule className="my-8" />

            {/* Full Match Brief */}
            <div className="rounded-[var(--radius-feature)] border border-line bg-soft/60 p-6">
              <MatchBrief data={job.match} variant="full" />
            </div>

            {/* Source disclosure */}
            <div className="mt-6 rounded-[var(--radius-card)] border border-line p-4">
              <Kicker className="mb-2">Source & disclosure</Kicker>
              <p className="text-[13px] text-slate">
                RoleBrief indexed this role from <span className="text-ink">{job.source}</span> and links you to the
                employer's own site (<span className="font-data text-ink">{domain}</span>) to apply. We don't post jobs
                or charge employers for ranking.
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
              <EligibilityShield state={job.eligibility.state} reasons={job.eligibility.reasons} variant="detail" />
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

