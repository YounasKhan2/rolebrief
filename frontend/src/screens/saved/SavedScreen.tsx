import { useState } from "react";
import { Link } from "react-router";
import { Bell, Pause, Play, Trash2, Pencil, Check, ChevronRight, Bookmark, GitCompareArrows } from "lucide-react";
import { PageContainer, PageHeader } from "../../components/shell/AppShell";
import { Kicker, Badge, Button, CompanyLogo, EmptyState } from "../../components/ui/primitives";
import { Tabs, Checkbox } from "../../components/ui/form";
import { JobCard } from "../../components/rolebrief/JobCard";
import { jobs, savedSearches, companies, companyName } from "../../lib/fixtures";
import { relativeTime } from "../../lib/format";
import { useToast } from "../../components/ui/toast";

type Tab = "jobs" | "searches" | "companies";

export function Component() {
  const toast = useToast();
  const [tab, setTab] = useState<Tab>("jobs");
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const savedJobs = jobs.filter((j) => ["senior-frontend-engineer-meridian", "data-engineer-atlas", "ml-engineer-meridian"].includes(j.slug));

  function toggleSelect(slug: string) {
    setSelected((prev) => { const n = new Set(prev); n.has(slug) ? n.delete(slug) : n.add(slug); return n; });
  }

  return (
    <PageContainer>
      <PageHeader
        kicker="Saved Briefs"
        title="Everything you kept for action."
        description="Jobs, searches and companies — with what changed since you saved them."
        actions={
          tab === "jobs" ? (
            <div className="flex items-center gap-2">
              <Link
                to={`/compare?jobs=${savedJobs.slice(0, 3).map((j) => j.slug).join(",")}`}
                className="inline-flex items-center gap-2 h-11 px-4 rounded-[var(--radius-control)] border border-ink/80 text-sm font-medium text-ink hover:bg-soft transition-colors"
              >
                <GitCompareArrows size={16} /> Compare
              </Link>
              <Button variant="secondary" onClick={() => { setSelectMode((s) => !s); setSelected(new Set()); }}>
                {selectMode ? "Done" : "Select"}
              </Button>
            </div>
          ) : undefined
        }
      />

      <div className="mb-6">
        <Tabs
          value={tab}
          onChange={(v) => { setTab(v); setSelectMode(false); }}
          tabs={[
            { value: "jobs", label: "Jobs", count: savedJobs.length },
            { value: "searches", label: "Searches", count: savedSearches.length },
            { value: "companies", label: "Companies", count: companies.length },
          ]}
        />
      </div>

      {/* Bulk actions appear only after selection */}
      {selectMode && selected.size > 0 && (
        <div className="mb-4 flex items-center gap-3 rounded-[var(--radius-card)] bg-ink text-white px-4 py-2.5 text-sm">
          <span className="font-data">{selected.size} selected</span>
          <div className="grow" />
          <button className="hover:text-paper/80" onClick={() => toast({ kind: "success", message: `Alert created from ${selected.size} saved roles.` })}>Create alert</button>
          <button className="hover:text-red" onClick={() => { toast({ kind: "info", message: "Removed from saved." }); setSelected(new Set()); }}>Remove</button>
        </div>
      )}

      {tab === "jobs" && (
        savedJobs.length === 0 ? (
          <EmptyState icon={<Bookmark size={40} />} title="No saved jobs yet" body="Save roles from Radar or Jobs to compare them here." action={<Link to="/jobs" className="text-indigo font-medium">Browse jobs</Link>} />
        ) : (
          <div className="space-y-4">
            {savedJobs.map((j) => {
              const expired = j.flags?.includes("expired");
              return (
                <div key={j.slug} className="flex items-start gap-3">
                  {selectMode && (
                    <div className="pt-5">
                      <Checkbox label="" checked={selected.has(j.slug)} onChange={() => toggleSelect(j.slug)} />
                    </div>
                  )}
                  <div className="grow">
                    <JobCard job={j} variant="comfortable" saved onSave={() => toast({ kind: "info", message: "Removed from saved." })} />
                    <div className="mt-1.5 px-1 text-[12px] text-slate flex items-center gap-2">
                      {expired ? (
                        <>
                          <Badge tone="red">Expired</Badge>
                          <Link to="/jobs" className="text-indigo font-medium">See similar eligible roles</Link>
                        </>
                      ) : (
                        <span>Recommended next: {j.eligibility.state === "conflict" ? "resolve the on-site conflict" : "apply while it's fresh"}.</span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )
      )}

      {tab === "searches" && (
        <div className="space-y-4">
          {savedSearches.map((s) => (
            <div key={s.id} className="rounded-[var(--radius-card)] border border-line p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-ink">{s.name}</h3>
                    {s.paused && <Badge tone="amber">Paused</Badge>}
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {s.criteria.map((c) => <Badge key={c} tone="slate">{c}</Badge>)}
                  </div>
                </div>
                <div className="flex items-center gap-1 text-slate">
                  <Button variant="tertiary" size="sm" icon={s.paused ? <Play size={14} /> : <Pause size={14} />} onClick={() => toast({ kind: "info", message: s.paused ? "Search resumed." : "Search paused." })}>
                    {s.paused ? "Resume" : "Pause"}
                  </Button>
                  <Button variant="tertiary" size="sm" icon={<Pencil size={14} />}>Refine</Button>
                  <Button variant="tertiary" size="sm" icon={<Trash2 size={14} />} onClick={() => toast({ kind: "info", message: "Search deleted." })}>Delete</Button>
                </div>
              </div>
              <div className="mt-4 pt-3 border-t border-line flex flex-wrap items-center gap-x-6 gap-y-1 text-[13px] text-slate font-data">
                <span>Frequency: {s.frequency}</span>
                <span>Expected: {s.expectedVolume}</span>
                <span>Last match: {relativeTime(s.lastMatch)}</span>
                <div className="grow" />
                <Link to="/app/alerts" className="text-indigo font-medium inline-flex items-center gap-1 not-italic"><Bell size={13} /> Turn into alert</Link>
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === "companies" && (
        <div className="grid sm:grid-cols-2 gap-4">
          {companies.slice(0, 3).map((c) => {
            const roles = jobs.filter((j) => j.companySlug === c.slug && !j.flags?.includes("expired"));
            return (
              <div key={c.slug} className="rounded-[var(--radius-card)] border border-line p-5">
                <div className="flex items-center gap-3">
                  <CompanyLogo name={c.name} size={44} />
                  <div className="grow">
                    <Link to={`/companies/${c.slug}`} className="font-semibold text-ink hover:text-indigo">{c.name}</Link>
                    <p className="text-[12px] text-slate font-data">{roles.length} open roles</p>
                  </div>
                  <Badge tone="emerald"><Check size={12} /> Following</Badge>
                </div>
                <p className="mt-3 text-[13px] text-slate">{c.momentum.summary.split(".")[0]}.</p>
                <Link to={`/companies/${c.slug}`} className="mt-3 text-[13px] text-indigo font-medium inline-flex items-center gap-1">
                  Latest signal <ChevronRight size={14} />
                </Link>
              </div>
            );
          })}
        </div>
      )}
    </PageContainer>
  );
}
