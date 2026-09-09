import { useMemo, useState } from "react";
import { Link } from "react-router";
import { RefreshCw, AlertTriangle, CheckCircle2, Sliders, ArrowRight, CalendarClock } from "lucide-react";
import { PageContainer } from "../../components/shell/AppShell";
import { Kicker, Button, SectionRule, EmptyState, Skeleton, CompanyLogo } from "../../components/ui/primitives";
import { SegmentedControl } from "../../components/ui/form";
import { JobCard } from "../../components/rolebrief/JobCard";
import { useJobs } from "../../lib/jobs";
import { useToast } from "../../components/ui/toast";
import { useSaved } from "../../lib/saved-context";
import { useTracker } from "../../lib/tracker-context";
import { useAuth } from "../../lib/auth";
import { useBatchMatchBriefs } from "../../lib/match-briefs";

type Lens = "Relevance" | "Freshest" | "Eligible only";

export function Component() {
  const toast = useToast();
  const { savedCount } = useSaved();
  const { stageCounts } = useTracker();
  const totalTracked = Object.values(stageCounts).reduce((a, b) => a + b, 0);
  const [lens, setLens] = useState<Lens>("Relevance");
  const [refreshing, setRefreshing] = useState(false);
  const { data: jobs, loading, error, retry } = useJobs({ limit: 20 });
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  const activeJobs = jobs.filter((j) => !dismissed.has(j.slug));
  const auth = useAuth();
  const visibleSlugs = useMemo(() => activeJobs.map((j) => j.slug), [activeJobs]);
  const { summaries: matchSummaries } = useBatchMatchBriefs(visibleSlugs, auth.user, auth.isAuthenticated && !auth.isAdmin);
  const lensJobs =
    lens === "Eligible only" ? activeJobs.filter((j) => j.eligibility.state === "eligible") : activeJobs;
  const companyNames = Array.from(new Set(activeJobs.map((job) => job.companyName))).slice(0, 3);

  function refresh() {
    setRefreshing(true);
    retry();
    setTimeout(() => setRefreshing(false), 700);
  }

  function dismiss(slug: string) {
    setDismissed((prev) => new Set(prev).add(slug));
    toast({
      kind: "info",
      message: "Dismissed. We'll show fewer like this.",
      undo: () =>
        setDismissed((p) => {
          const n = new Set(p);
          n.delete(slug);
          return n;
        }),
    });
  }

  return (
    <PageContainer>
      {/* Briefing header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Kicker className="mb-2">Live provider brief</Kicker>
          <h1 className="font-display text-4xl text-navy">RoleBrief Radar</h1>
          <p className="text-slate mt-2 max-w-xl">
            <span className="text-ink font-medium">{activeJobs.length} stored role{activeJobs.length === 1 ? "" : "s"}</span> from the Himalayas-backed Jobs API. Matching, deadlines and company moves stay unavailable until those backend features exist.
          </p>
        </div>
        <Button variant="secondary" onClick={refresh} icon={<RefreshCw size={16} className={refreshing ? "animate-spin" : ""} />}>
          {refreshing ? "Refreshing" : "Refresh"}
        </Button>
      </div>

      {/* Summary tiles */}
      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        <SummaryTile tone="indigo" title={`${activeJobs.length} stored roles`} body="Read from the backend Jobs API" />
        <SummaryTile tone="cyan" title="Company moves unavailable" body="No live news provider connected" />
        <SummaryTile
          tone="emerald"
          title={`${totalTracked} active role${totalTracked === 1 ? "" : "s"} tracked`}
          body="Live status in Application Tracker"
          icon={<CalendarClock size={18} />}
        />
      </div>

      {/* Provider outage notice (partial state) */}
      <div className="mt-4 flex items-center gap-3 rounded-[var(--radius-card)] border border-line bg-soft/60 px-4 py-3 text-[13px] text-ink">
        <AlertTriangle size={16} className="text-amber shrink-0" />
        Company momentum and news alerts remain unavailable until their ingestion feeds are connected. Application Tracker and Saved Briefs are live.
      </div>

      <div className="mt-8 grid lg:grid-cols-[1fr_320px] gap-8 items-start">
        {/* Main stream */}
        <div>
          {/* Preference lens */}
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <div className="inline-flex items-center gap-2 text-sm text-slate">
              <Sliders size={15} /> Preference lens
            </div>
            <SegmentedControl
              value={lens}
              onChange={setLens}
              size="sm"
              options={[
                { value: "Relevance", label: "Relevance" },
                { value: "Freshest", label: "Freshest" },
                {
                  value: "Eligible only",
                  label: "Eligible only",
                  disabled: true,
                  title: "Catalog-wide eligibility filtering will be enabled with the radar matching feed."
                }
              ]}
            />
          </div>

          {loading || refreshing ? (
            <div className="space-y-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="rounded-[var(--radius-card)] border border-line p-5">
                  <div className="flex gap-3">
                    <Skeleton className="size-11 rounded-[10px]" />
                    <div className="grow space-y-2">
                      <Skeleton className="h-5 w-2/3" />
                      <Skeleton className="h-4 w-1/2" />
                    </div>
                  </div>
                  <Skeleton className="h-12 w-full mt-4 rounded-[10px]" />
                </div>
              ))}
            </div>
          ) : error ? (
            <EmptyState
              icon={<AlertTriangle size={40} className="text-amber" />}
              title="Radar could not load jobs"
              body={error.message}
              action={<Button variant="secondary" onClick={refresh}>Retry</Button>}
            />
          ) : lensJobs.length === 0 ? (
            <EmptyState
              icon={<CheckCircle2 size={40} className="text-emerald" />}
              title="You're all caught up"
              body="No new roles match this lens right now. Widen your lens or check back after the next sync."
              action={<Button variant="secondary" onClick={() => setLens("Relevance")}>Reset lens</Button>}
            />
          ) : (
            <div className="space-y-8">
              {/* Top opportunities (80% jobs) with an interleaved news signal (20%) */}
              <div>
                <SectionLabel>Recent opportunities</SectionLabel>
                <div className="space-y-4">
                  {lensJobs.slice(0, 2).map((j) => (
                    <JobCard
                      key={j.slug}
                      job={{ ...j, match: { ...j.match, summary: matchSummaries.get(j.slug) } }}
                      onDismiss={() => dismiss(j.slug)}
                      onHideCompany={() => toast({ kind: "info", message: `Hidden ${j.companyName} from Radar.` })}
                      onReport={() => toast({ kind: "warning", message: "Thanks — we'll review this listing." })}
                    />
                  ))}
                </div>
              </div>

              <div>
                <SectionLabel>Focused news · from companies you follow</SectionLabel>
                <EmptyState title="Focused news unavailable" body="News remains demo-only and is not mixed with live provider jobs." />
              </div>

              <div>
                <SectionLabel>More opportunities</SectionLabel>
                <div className="space-y-4">
                  {lensJobs.slice(2).map((j) => (
                    <JobCard
                      key={j.slug}
                      job={{ ...j, match: { ...j.match, summary: matchSummaries.get(j.slug) } }}
                      onDismiss={() => dismiss(j.slug)}
                      onHideCompany={() => toast({ kind: "info", message: `Hidden ${j.companyName} from Radar.` })}
                    />
                  ))}
                </div>
              </div>

            </div>
          )}
        </div>

        {/* Insight rail */}
        <aside className="space-y-6 lg:sticky lg:top-20">
          <div className="rounded-[var(--radius-card)] border border-line p-5">
            <SectionLabel>Followed companies</SectionLabel>
            <div className="space-y-3">
              {companyNames.length === 0 && <p className="text-[13px] text-slate">No followed-company data is connected yet.</p>}
              {companyNames.map((name) => (
                <div key={name} className="flex items-center gap-3">
                  <CompanyLogo name={name} size={36} />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-ink truncate">{name}</p>
                    <p className="text-[12px] text-slate truncate">Appears in stored provider jobs.</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-[var(--radius-card)] border border-line p-5">
            <SectionLabel>Company momentum</SectionLabel>
            <p className="text-sm text-slate">Unavailable. The backend has not connected live company news or momentum signals.</p>
            <SectionRule className="my-4" />
            <Link to="/app/jobs" className="text-[13px] text-indigo font-medium inline-flex items-center gap-1">
              Browse stored jobs <ArrowRight size={14} />
            </Link>
          </div>

          <div className="rounded-[var(--radius-card)] border border-line p-5">
            <SectionLabel>Saved with deadlines</SectionLabel>
            {savedCount === 0 ? (
              <p className="text-[13px] text-slate">No saved jobs yet. Save jobs to monitor their deadlines and application dates.</p>
            ) : (
              <div>
                <p className="text-[13px] text-ink font-medium">{savedCount} saved {savedCount === 1 ? "brief" : "briefs"}</p>
                <p className="text-[12px] text-slate mt-1">Deadlines and reminders will populate as providers supply them.</p>
                <Link to="/app/saved" className="text-[13px] text-indigo font-medium inline-flex items-center gap-1 mt-2">
                  View saved briefs <ArrowRight size={14} />
                </Link>
              </div>
            )}
          </div>
        </aside>
      </div>
    </PageContainer>
  );
}

function SummaryTile({ tone, title, body, icon }: { tone: "indigo" | "cyan" | "amber"; title: string; body: string; icon?: React.ReactNode }) {
  const tint = tone === "indigo" ? "bg-indigo-tint" : tone === "cyan" ? "bg-cyan-tint" : "bg-amber-tint";
  return (
    <div className={`rounded-[var(--radius-card)] ${tint} p-4`}>
      <div className="flex items-center justify-between">
        <p className="font-semibold text-ink">{title}</p>
        {icon}
      </div>
      <p className="text-[13px] text-slate mt-0.5">{body}</p>
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="kicker mb-3 flex items-center gap-2">
      <span className="inline-block w-4 h-px bg-ink/40" aria-hidden />
      {children}
    </h2>
  );
}
