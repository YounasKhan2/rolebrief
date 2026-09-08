import { useEffect, useMemo, useState, useRef } from "react";
import { useSearchParams } from "react-router";
import { Search, SlidersHorizontal, X, Save, ArrowUpDown, FileX, Loader2 } from "lucide-react";
import { PageContainer } from "../../components/shell/AppShell";
import { Button, FilterChip, Kicker, EmptyState, IconButton } from "../../components/ui/primitives";
import { Input, SegmentedControl } from "../../components/ui/form";
import { Sheet } from "../../components/ui/overlay";
import { JobCard } from "../../components/rolebrief/JobCard";
import { useJobs, disciplines } from "../../lib/jobs";
import { useToast } from "../../components/ui/toast";
import { classNames } from "../../lib/format";
import { useAuthGate } from "../../components/auth/AuthGateDialog";

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
  const authGate = useAuthGate();
  const [filtersOpen, setFiltersOpen] = useState(false);

  const urlQ = params.get("q") ?? "";
  const [searchInput, setSearchInput] = useState(urlQ);

  // Sync search input if URL changes externally (e.g. browser back/forward)
  useEffect(() => {
    setSearchInput(urlQ);
  }, [urlQ]);

  // Debounce search query by 300ms
  useEffect(() => {
    const handler = setTimeout(() => {
      if (searchInput !== urlQ) {
        update({ q: searchInput });
      }
    }, 300);
    return () => clearTimeout(handler);
  }, [searchInput, urlQ]);

  const sort = (params.get("sort") ?? (urlQ ? "relevance" : "newest")) as "best" | "newest" | "relevance";
  const density = (params.get("density") ?? "comfortable") as "comfortable" | "compact";

  const discParam = params.get("disc") ?? "";
  const remoteParam = params.get("remote") ?? "";
  const seniorParam = params.get("senior") ?? "";
  const eligParam = params.get("elig") ?? "";
  const salaryOnly = params.get("salary") === "1";

  const disc = useMemo(() => new Set(discParam.split(",").filter(Boolean)), [discParam]);
  const remote = useMemo(() => new Set(remoteParam.split(",").filter(Boolean)), [remoteParam]);
  const senior = useMemo(() => new Set(seniorParam.split(",").filter(Boolean)), [seniorParam]);
  const elig = useMemo(() => new Set(eligParam.split(",").filter(Boolean)), [eligParam]);

  const jobsOptions = useMemo(
    () => ({
      q: urlQ,
      disc,
      remote,
      senior,
      salaryOnly,
      sort: sort === "best" ? "relevance" : sort,
      limit: 20
    }),
    [urlQ, disc, remote, senior, salaryOnly, sort]
  );

  const {
    data: jobs,
    totalCount,
    loading,
    loadingMore,
    hasNextPage,
    error,
    loadMore,
    retry
  } = useJobs(jobsOptions);

  const sentinelRef = useRef<HTMLDivElement | null>(null);

  // Threshold-based infinite scrolling with accessible Load More fallback
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || !hasNextPage || loading || loadingMore || error) return;
    if (typeof IntersectionObserver === "undefined") return;

    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        if (entry.isIntersecting) {
          loadMore();
        }
      },
      {
        rootMargin: "300px", // Trigger slightly before user scrolls to the absolute bottom
        threshold: 0.1,
      }
    );

    observer.observe(sentinel);

    return () => {
      observer.disconnect();
    };
  }, [hasNextPage, loading, loadingMore, error, loadMore]);


  function update(next: Record<string, string | null>) {
    const p = new URLSearchParams(params);
    for (const [k, v] of Object.entries(next)) {
      if (v === null || v === "") p.delete(k);
      else p.set(k, v);
    }
    // Remove pagination cursor when updating search/filters
    p.delete("cursor");
    setParams(p, { replace: true });
  }

  function toggleMulti(k: string, v: string) {
    const raw = params.get(k) ?? "";
    const set = new Set(raw.split(",").filter(Boolean));
    set.has(v) ? set.delete(v) : set.add(v);
    update({ [k]: [...set].join(",") });
  }

  const activeCount = disc.size + remote.size + senior.size + elig.size + (salaryOnly ? 1 : 0);

  function clearAll() {
    setSearchInput("");
    update({ q: null, disc: null, remote: null, senior: null, elig: null, salary: null });
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
      <FilterGroup title="Salary">
        <FilterChip active={salaryOnly} onClick={() => update({ salary: salaryOnly ? null : "1" })}>Employer-provided salary</FilterChip>
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
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
            />
          </div>
          <Button variant="secondary" className="md:hidden" onClick={() => setFiltersOpen(true)} icon={<SlidersHorizontal size={16} />}>
            Filters{activeCount ? ` (${activeCount})` : ""}
          </Button>
          <div className="hidden md:flex items-center gap-2">
            <SegmentedControl
              value={sort === "relevance" ? "best" : sort}
              onChange={(v) => update({ sort: v })}
              size="sm"
              options={[{ value: "best", label: "Best match" }, { value: "newest", label: "Newest" }]}
            />
            <SegmentedControl
              value={density}
              onChange={(v) => update({ density: v })}
              size="sm"
              options={[{ value: "comfortable", label: "Comfortable" }, { value: "compact", label: "Compact" }]}
            />
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
              {loading ? (
                <span>Searching stored jobs...</span>
              ) : (
                <>
                  Showing <span className="font-semibold text-ink font-data">{jobs.length}</span> of{" "}
                  <span className="font-semibold text-ink font-data">{totalCount}</span> role{totalCount !== 1 ? "s" : ""}
                  {urlQ && <> for "<span className="text-ink">{urlQ}</span>"</>}
                </>
              )}
            </p>
            <Button
              variant="tertiary"
              size="sm"
              icon={<Save size={15} />}
              onClick={() => toast({ kind: "info", message: "Saved searches are unavailable until the next phase." })}
            >
              Save search
            </Button>
          </div>

          {loading ? (
            <JobListSkeleton density={density} />
          ) : error && jobs.length === 0 ? (
            <EmptyState
              icon={<FileX size={40} />}
              title="Could not load jobs"
              body={error.message}
              action={<Button variant="secondary" onClick={retry}>Retry</Button>}
            />
          ) : jobs.length === 0 ? (
            <EmptyState
              icon={<FileX size={40} />}
              title="No roles match those filters"
              body={totalCount === 0 && !urlQ && activeCount === 0 ? "No stored Himalayas jobs are available yet." : "Try clearing or broadening your search terms and filters."}
              action={<Button variant="secondary" onClick={clearAll} icon={<ArrowUpDown size={16} />}>Clear filters</Button>}
            />
          ) : (
            <>
              <div className={classNames(density === "compact" ? "space-y-2.5" : "space-y-4")}>
                {jobs.map((j) => (
                  <JobCard
                    key={j.slug}
                    job={j}
                    variant={density === "compact" ? "compact" : "comfortable"}
                  />
                ))}
              </div>

              {/* Sentinel for threshold-based infinite scrolling */}
              {hasNextPage && !loading && (
                <div ref={sentinelRef} className="h-4 w-full" aria-hidden="true" />
              )}

              {loadingMore && (
                <div className="mt-4">
                  <JobListSkeleton density={density} count={2} />
                </div>
              )}

              <div className="mt-6 flex flex-col sm:flex-row items-center justify-between gap-4 py-4 border-t border-line">
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2">
                  <span className="text-xs text-slate">
                    Loaded {jobs.length} of {totalCount} total jobs
                  </span>
                  {error && (
                    <span className="text-xs text-red font-medium">
                      Failed to load more. Click below to retry.
                    </span>
                  )}
                </div>
                {hasNextPage ? (
                  <Button
                    variant="secondary"
                    onClick={loadMore}
                    disabled={loadingMore}
                    icon={loadingMore ? <Loader2 size={16} className="animate-spin" /> : undefined}
                  >
                    {loadingMore ? "Loading more..." : "Load more jobs"}
                  </Button>
                ) : (
                  <span className="text-xs text-slate italic">All matching roles loaded</span>
                )}
              </div>
            </>
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
            <Button className="grow" onClick={() => setFiltersOpen(false)}>Show {loading ? "" : `${totalCount} results`}</Button>
          </>
        }
      >
        <div className="mb-5">
          <SegmentedControl
            value={sort === "relevance" ? "best" : sort}
            onChange={(v) => update({ sort: v })}
            size="sm"
            options={[{ value: "best", label: "Best match" }, { value: "newest", label: "Newest" }]}
          />
        </div>
        {filterRail}
      </Sheet>
    </PageContainer>
  );
}

function JobListSkeleton({ density, count = 4 }: { density: "comfortable" | "compact"; count?: number }) {
  return (
    <div className={classNames(density === "compact" ? "space-y-2.5" : "space-y-4")}>
      {Array.from({ length: count }).map((_, index) => (
        <div key={index} className="rounded-[var(--radius-card)] border border-line bg-white p-5">
          <div className="flex gap-3.5">
            <div className="size-11 rounded-[10px] bg-soft animate-pulse" />
            <div className="grow space-y-2">
              <div className="h-5 w-2/3 rounded bg-soft animate-pulse" />
              <div className="h-4 w-4/5 rounded bg-soft animate-pulse" />
            </div>
          </div>
          {density === "comfortable" && <div className="mt-4 h-14 rounded-[10px] bg-soft animate-pulse" />}
        </div>
      ))}
    </div>
  );
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
