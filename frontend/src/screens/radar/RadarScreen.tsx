import { useState } from "react";
import { Link } from "react-router";
import { RefreshCw, AlertTriangle, CheckCircle2, Sliders, ArrowRight, CalendarClock, Building2 } from "lucide-react";
import { PageContainer } from "../../components/shell/AppShell";
import { Kicker, Button, SectionRule, EmptyState, Skeleton, CompanyLogo } from "../../components/ui/primitives";
import { SegmentedControl } from "../../components/ui/form";
import { JobCard } from "../../components/rolebrief/JobCard";
import { NewsCard } from "../../components/rolebrief/NewsCard";
import { CompanyMomentum } from "../../components/rolebrief/CompanyMomentum";
import { jobs, news, companies, companyName } from "../../lib/fixtures";
import { useToast } from "../../components/ui/toast";
import { relativeTime } from "../../lib/format";

type Lens = "Best match" | "Freshest" | "Eligible only";

export function Component() {
  const toast = useToast();
  const [lens, setLens] = useState<Lens>("Best match");
  const [refreshing, setRefreshing] = useState(false);
  const [saved, setSaved] = useState<Set<string>>(new Set(["senior-frontend-engineer-meridian"]));
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  const activeJobs = jobs.filter((j) => !dismissed.has(j.slug) && !j.flags?.includes("expired"));
  const lensJobs =
    lens === "Eligible only" ? activeJobs.filter((j) => j.eligibility.state === "eligible") : activeJobs;

  function refresh() {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 1100);
  }
  function toggleSave(slug: string) {
    setSaved((prev) => {
      const n = new Set(prev);
      n.has(slug) ? n.delete(slug) : n.add(slug);
      return n;
    });
  }
  function dismiss(slug: string) {
    setDismissed((prev) => new Set(prev).add(slug));
    toast({ kind: "info", message: "Dismissed. We'll show fewer like this.", undo: () => setDismissed((p) => { const n = new Set(p); n.delete(slug); return n; }) });
  }

  return (
    <PageContainer>
      {/* Briefing header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Kicker className="mb-2">Tuesday · 2 September · your daily brief</Kicker>
          <h1 className="font-display text-4xl text-navy">Good morning, Ayesha.</h1>
          <p className="text-slate mt-2 max-w-xl">
            <span className="text-ink font-medium">4 new matches</span> since yesterday, 2 followed companies moved, and one saved role has a deadline this week.
          </p>
        </div>
        <Button variant="secondary" onClick={refresh} icon={<RefreshCw size={16} className={refreshing ? "animate-spin" : ""} />}>
          {refreshing ? "Refreshing" : "Refresh"}
        </Button>
      </div>

      {/* Summary tiles */}
      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        <SummaryTile tone="indigo" title="4 new matches" body="Ranked and eligibility-checked" />
        <SummaryTile tone="cyan" title="2 company moves" body="Meridian raised · Qamar reorg" />
        <SummaryTile tone="amber" title="1 deadline" body="Meridian frontend · in 3 days" icon={<CalendarClock size={18} />} />
      </div>

      {/* Provider outage notice (partial state) */}
      <div className="mt-4 flex items-center gap-3 rounded-[var(--radius-card)] border border-amber/30 bg-amber-tint px-4 py-3 text-[13px] text-ink">
        <AlertTriangle size={16} className="text-amber shrink-0" />
        One source (Bayt.com) is slow right now — some UAE roles may be delayed. Everything else is current.
      </div>

      <div className="mt-8 grid lg:grid-cols-[1fr_320px] gap-8 items-start">
        {/* Main stream */}
        <div>
          {/* Preference lens */}
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <div className="inline-flex items-center gap-2 text-sm text-slate">
              <Sliders size={15} /> Preference lens
            </div>
            <SegmentedControl value={lens} onChange={setLens} size="sm" options={(["Best match", "Freshest", "Eligible only"] as Lens[]).map((l) => ({ value: l, label: l }))} />
          </div>

          {refreshing ? (
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
          ) : lensJobs.length === 0 ? (
            <EmptyState
              icon={<CheckCircle2 size={40} className="text-emerald" />}
              title="You're all caught up"
              body="No new roles match this lens right now. Widen your lens or check back after the next sync."
              action={<Button variant="secondary" onClick={() => setLens("Best match")}>Reset lens</Button>}
            />
          ) : (
            <div className="space-y-8">
              {/* Top opportunities (80% jobs) with an interleaved news signal (20%) */}
              <div>
                <SectionLabel>Top opportunities for you</SectionLabel>
                <div className="space-y-4">
                  {lensJobs.slice(0, 2).map((j) => (
                    <JobCard
                      key={j.slug}
                      job={j}
                      saved={saved.has(j.slug)}
                      onSave={() => toggleSave(j.slug)}
                      onDismiss={() => dismiss(j.slug)}
                      onHideCompany={() => toast({ kind: "info", message: `Hidden ${companyName(j.companySlug)} from Radar.` })}
                      onReport={() => toast({ kind: "warning", message: "Thanks — we'll review this listing." })}
                    />
                  ))}
                </div>
              </div>

              <div>
                <SectionLabel>Focused news · from companies you follow</SectionLabel>
                <NewsCard item={news[0]} variant="standard" />
              </div>

              <div>
                <SectionLabel>More opportunities</SectionLabel>
                <div className="space-y-4">
                  {lensJobs.slice(2).map((j) => (
                    <JobCard
                      key={j.slug}
                      job={j}
                      saved={saved.has(j.slug)}
                      onSave={() => toggleSave(j.slug)}
                      onDismiss={() => dismiss(j.slug)}
                      onHideCompany={() => toast({ kind: "info", message: `Hidden ${companyName(j.companySlug)} from Radar.` })}
                    />
                  ))}
                </div>
              </div>

              <div>
                <SectionLabel>Worth exploring · a small stretch</SectionLabel>
                <JobCard job={jobs[1]} variant="compact" saved={saved.has(jobs[1].slug)} onSave={() => toggleSave(jobs[1].slug)} />
              </div>
            </div>
          )}
        </div>

        {/* Insight rail */}
        <aside className="space-y-6 lg:sticky lg:top-20">
          <div className="rounded-[var(--radius-card)] border border-line p-5">
            <SectionLabel>Followed companies</SectionLabel>
            <div className="space-y-3">
              {companies.slice(0, 3).map((c) => (
                <Link key={c.slug} to={`/companies/${c.slug}`} className="flex items-center gap-3 group">
                  <CompanyLogo name={c.name} size={36} />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-ink group-hover:text-indigo truncate">{c.name}</p>
                    <p className="text-[12px] text-slate truncate">{c.momentum.summary.split(".")[0]}.</p>
                  </div>
                </Link>
              ))}
            </div>
          </div>

          <div className="rounded-[var(--radius-card)] border border-line p-5">
            <SectionLabel>Company momentum</SectionLabel>
            <CompanyMomentum company={companies[0]} variant="strip" />
            <SectionRule className="my-4" />
            <Link to={`/companies/${companies[0].slug}`} className="text-[13px] text-indigo font-medium inline-flex items-center gap-1">
              Open {companies[0].name} <ArrowRight size={14} />
            </Link>
          </div>

          <div className="rounded-[var(--radius-card)] border border-line p-5">
            <SectionLabel>Saved with deadlines</SectionLabel>
            {[...saved].slice(0, 2).map((slug) => {
              const j = jobs.find((x) => x.slug === slug);
              if (!j) return null;
              return (
                <Link key={slug} to={`/jobs/${slug}`} className="flex items-start gap-2.5 py-1.5 group">
                  <Building2 size={15} className="text-slate mt-0.5" />
                  <div>
                    <p className="text-[13px] font-medium text-ink group-hover:text-indigo">{j.title}</p>
                    <p className="text-[12px] text-slate">Verified {relativeTime(j.freshness[j.freshness.length - 1].at)}</p>
                  </div>
                </Link>
              );
            })}
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
