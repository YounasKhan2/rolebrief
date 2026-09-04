import { useMemo, useState } from "react";
import { useSearchParams } from "react-router";
import { Search, SlidersHorizontal, X, Save, ArrowUpDown, FileX } from "lucide-react";
import { PageContainer } from "../../components/shell/AppShell";
import { Button, FilterChip, Kicker, EmptyState, IconButton } from "../../components/ui/primitives";
import { Input, SegmentedControl } from "../../components/ui/form";
import { Sheet } from "../../components/ui/overlay";
import { JobCard } from "../../components/rolebrief/JobCard";
import { jobs, disciplines, companies } from "../../lib/fixtures";
import type { Job } from "../../lib/fixtures";
import { useToast } from "../../components/ui/toast";
import { classNames } from "../../lib/format";

const remoteFilters = [
  { key: "worldwide", label: "Worldwide remote" },
  { key: "country-eligible", label: "Country-eligible remote" },
  { key: "region-limited", label: "Region-limited remote" },
  { key: "unknown", label: "Unknown remote" },
  { key: "on-site", label: "On-site" },
  { key: "hybrid", label: "Hybrid" },
];
const seniorities = ["Junior", "Mid", "Senior", "Principal"];
const eligibilityFilters = [
  { key: "eligible", label: "Eligible" },
  { key: "check", label: "Check required" },
  { key: "conflict", label: "Conflict" },
  { key: "unknown", label: "Unknown" },
];

// Filters live in the URL (useSearchParams) so state survives back-navigation.
export function Component() {
  const [params, setParams] = useSearchParams();
  const toast = useToast();
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [saved, setSaved] = useState<Set<string>>(new Set());

  const q = params.get("q") ?? "";
  const sort = (params.get("sort") ?? "best") as "best" | "newest";
  const density = (params.get("density") ?? "comfortable") as "comfortable" | "compact";
  const getMulti = (k: string) => new Set((params.get(k) ?? "").split(",").filter(Boolean));
  const disc = getMulti("disc");
  const remote = getMulti("remote");
  const senior = getMulti("senior");
  const elig = getMulti("elig");
  const salaryOnly = params.get("salary") === "1";

  function update(next: Record<string, string | null>) {
    const p = new URLSearchParams(params);
    for (const [k, v] of Object.entries(next)) {
      if (v === null || v === "") p.delete(k);
      else p.set(k, v);
    }
    setParams(p, { replace: true });
  }
  function toggleMulti(k: string, v: string) {
    const set = getMulti(k);
    set.has(v) ? set.delete(v) : set.add(v);
    update({ [k]: [...set].join(",") });
  }

  const results = useMemo(() => {
    return jobs.filter((j) => {
      if (j.flags?.includes("expired")) return false;
      if (q && !`${j.title} ${j.skills.join(" ")}`.toLowerCase().includes(q.toLowerCase())) return false;
      if (disc.size && !disc.has(j.discipline)) return false;
      if (remote.size && !remote.has(j.remoteEligibility)) return false;
      if (senior.size && !senior.has(j.seniority)) return false;
      if (elig.size && !elig.has(j.eligibility.state)) return false;
      if (salaryOnly && !(j.salary && j.salary.provided)) return false;
      return true;
    });
  }, [q, disc, remote, senior, elig, salaryOnly]);

  const sorted = useMemo(() => {
    const arr = [...results];
    if (sort === "newest") {
      arr.sort((a, b) => +new Date(latest(b)) - +new Date(latest(a)));
    } else {
      arr.sort((a, b) => b.match.score - a.match.score);
    }
    return arr;
  }, [results, sort]);

  const activeCount = disc.size + remote.size + senior.size + elig.size + (salaryOnly ? 1 : 0);

  function clearAll() {
    update({ disc: null, remote: null, senior: null, elig: null, salary: null });
  }
  function toggleSave(slug: string) {
    setSaved((prev) => { const n = new Set(prev); n.has(slug) ? n.delete(slug) : n.add(slug); return n; });
  }

  const filterRail = (
    <div className="space-y-6">
      <FilterGroup title="Discipline" onClear={disc.size ? () => update({ disc: null }) : undefined}>
        {disciplines.map((d) => (
          <FilterChip key={d} active={disc.has(d)} onClick={() => toggleMulti("disc", d)}>{d}</FilterChip>
        ))}
      </FilterGroup>
      <FilterGroup title="Remote & location" onClear={remote.size ? () => update({ remote: null }) : undefined}>
        {remoteFilters.map((r) => (
          <FilterChip key={r.key} active={remote.has(r.key)} onClick={() => toggleMulti("remote", r.key)}>{r.label}</FilterChip>
        ))}
      </FilterGroup>
      <FilterGroup title="Experience" onClear={senior.size ? () => update({ senior: null }) : undefined}>
        {seniorities.map((s) => (
          <FilterChip key={s} active={senior.has(s)} onClick={() => toggleMulti("senior", s)}>{s}</FilterChip>
        ))}
      </FilterGroup>
      <FilterGroup title="Eligibility Shield" onClear={elig.size ? () => update({ elig: null }) : undefined}>
        {eligibilityFilters.map((e) => (
          <FilterChip key={e.key} active={elig.has(e.key)} onClick={() => toggleMulti("elig", e.key)}>{e.label}</FilterChip>
        ))}
      </FilterGroup>
      <FilterGroup title="Salary & company">
        <FilterChip active={salaryOnly} onClick={() => update({ salary: salaryOnly ? null : "1" })}>Employer-provided salary</FilterChip>
        {companies.slice(0, 2).map((c) => (
          <FilterChip key={c.slug}>{c.name}</FilterChip>
        ))}
      </FilterGroup>
    </div>
  );

  return (
    <PageContainer>
      {/* Sticky search + quick controls */}
      <div className="sticky top-16 z-30 -mx-4 sm:-mx-6 lg:-mx-8 px-4 sm:px-6 lg:px-8 py-3 bg-white/90 backdrop-blur border-b border-line">
        <div className="flex items-center gap-3">
          <div className="grow">
            <Input
              aria-label="Search jobs"
              placeholder="Search title or skill — e.g. React, backend, Karachi"
              leading={<Search size={16} />}
              value={q}
              onChange={(e) => update({ q: e.target.value })}
            />
          </div>
          <Button variant="secondary" className="md:hidden" onClick={() => setFiltersOpen(true)} icon={<SlidersHorizontal size={16} />}>
            Filters{activeCount ? ` (${activeCount})` : ""}
          </Button>
          <div className="hidden md:flex items-center gap-2">
            <SegmentedControl value={sort} onChange={(v) => update({ sort: v })} size="sm" options={[{ value: "best", label: "Best match" }, { value: "newest", label: "Newest" }]} />
            <SegmentedControl value={density} onChange={(v) => update({ density: v })} size="sm" options={[{ value: "comfortable", label: "Comfortable" }, { value: "compact", label: "Compact" }]} />
          </div>
        </div>
        {/* Active chips */}
        {activeCount > 0 && (
          <div className="flex flex-wrap items-center gap-2 mt-3">
            {[...disc].map((d) => <ActiveChip key={d} label={d} onRemove={() => toggleMulti("disc", d)} />)}
            {[...remote].map((r) => <ActiveChip key={r} label={remoteFilters.find((x) => x.key === r)?.label ?? r} onRemove={() => toggleMulti("remote", r)} />)}
            {[...senior].map((s) => <ActiveChip key={s} label={s} onRemove={() => toggleMulti("senior", s)} />)}
            {[...elig].map((e) => <ActiveChip key={e} label={eligibilityFilters.find((x) => x.key === e)?.label ?? e} onRemove={() => toggleMulti("elig", e)} />)}
            {salaryOnly && <ActiveChip label="Employer-provided salary" onRemove={() => update({ salary: null })} />}
            <button onClick={clearAll} className="text-[13px] text-slate hover:text-red ml-1">Clear all</button>
          </div>
        )}
      </div>

      <div className="mt-6 grid lg:grid-cols-[260px_1fr] gap-8 items-start">
        {/* Left filter rail (desktop) */}
        <aside className="hidden lg:block lg:sticky lg:top-36">{filterRail}</aside>

        <div>
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm text-slate" role="status" aria-live="polite">
              <span className="font-semibold text-ink font-data">{sorted.length}</span> fresh role{sorted.length !== 1 ? "s" : ""}
              {q && <> for "<span className="text-ink">{q}</span>"</>}
            </p>
            <Button
              variant="tertiary"
              size="sm"
              icon={<Save size={15} />}
              onClick={() => toast({ kind: "success", message: "Search saved. Turn it into an alert any time." })}
            >
              Save search
            </Button>
          </div>

          {sorted.length === 0 ? (
            <EmptyState
              icon={<FileX size={40} />}
              title="No roles match those filters"
              body="Try removing the eligibility or remote filters, or broaden your discipline selection."
              action={<Button variant="secondary" onClick={clearAll} icon={<ArrowUpDown size={16} />}>Clear filters</Button>}
            />
          ) : (
            <div className={classNames(density === "compact" ? "space-y-2.5" : "space-y-4")}>
              {sorted.map((j) => (
                <JobCard key={j.slug} job={j} variant={density === "compact" ? "compact" : "comfortable"} saved={saved.has(j.slug)} onSave={() => toggleSave(j.slug)} />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Mobile filter sheet */}
      <Sheet
        open={filtersOpen}
        onClose={() => setFiltersOpen(false)}
        title="Filters"
        footer={
          <>
            <Button variant="secondary" className="grow" onClick={clearAll}>Clear all</Button>
            <Button className="grow" onClick={() => setFiltersOpen(false)}>Show {sorted.length} results</Button>
          </>
        }
      >
        <div className="mb-5">
          <SegmentedControl value={sort} onChange={(v) => update({ sort: v })} size="sm" options={[{ value: "best", label: "Best match" }, { value: "newest", label: "Newest" }]} />
        </div>
        {filterRail}
      </Sheet>
    </PageContainer>
  );
}

function latest(j: Job) {
  return [...j.freshness].sort((a, b) => +new Date(b.at) - +new Date(a.at))[0].at;
}

function FilterGroup({ title, children, onClear }: { title: string; children: React.ReactNode; onClear?: () => void }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-2.5">
        <Kicker>{title}</Kicker>
        {onClear && <button onClick={onClear} className="text-[12px] text-slate hover:text-red">Clear</button>}
      </div>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  );
}

function ActiveChip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span className="inline-flex items-center gap-1 h-8 pl-3 pr-1.5 rounded-full bg-indigo text-white text-[13px] font-medium">
      {label}
      <IconButton label={`Remove ${label}`} onClick={onRemove} className="size-6 text-white hover:bg-white/20">
        <X size={13} />
      </IconButton>
    </span>
  );
}
