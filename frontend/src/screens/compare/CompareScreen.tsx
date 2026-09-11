import { useSearchParams, Link } from "react-router";
import { X, Plus, GitCompareArrows, ExternalLink, Banknote, MapPin, Check, Minus } from "lucide-react";
import { PageContainer, PageHeader } from "../../shared/shell/AppShell";
import { Kicker, Badge, Button, LinkButton, CompanyLogo, EmptyState, SourceBadge } from "../../ui/primitives";
import { EligibilityShield } from "../../shared/rolebrief/EligibilityShield";
import { MatchBrief } from "../../shared/rolebrief/MatchBrief";
import { FreshnessTimeline } from "../../shared/rolebrief/FreshnessTimeline";
import { jobs, getJob, companyName, getCompany } from "../../lib/core/fixtures";
import type { Job } from "../../lib/core/fixtures";
import { domainFromUrl } from "../../lib/core/format";

const DEFAULT = ["senior-frontend-engineer-meridian", "data-engineer-atlas", "backend-engineer-qamar"];

export function Component() {
  const [params, setParams] = useSearchParams();
  const slugs = (params.get("jobs")?.split(",").filter(Boolean) ?? DEFAULT).slice(0, 3);
  const selected = slugs.map(getJob).filter(Boolean) as Job[];

  function setSlugs(next: string[]) {
    const p = new URLSearchParams(params);
    if (next.length) p.set("jobs", next.join(","));
    else p.delete("jobs");
    setParams(p, { replace: true });
  }

  const addable = jobs.filter((j) => !slugs.includes(j.slug) && !j.flags?.includes("expired"));

  if (selected.length === 0) {
    return (
      <PageContainer>
        <PageHeader kicker="Compare briefs" title="Weigh opportunities side by side." />
        <EmptyState
          icon={<GitCompareArrows size={40} />}
          title="Nothing to compare yet"
          body="Add two or three roles to see eligibility, match and freshness lined up against each other."
          action={<LinkButton to="/app/jobs" size="sm">Browse jobs</LinkButton>}
        />
      </PageContainer>
    );
  }

  // Union of dimension labels across selected briefs (stable order from the first with data).
  const dimLabels = selected.find((j) => j.match.dimensions.length)?.match.dimensions.map((d) => d.label) ?? [];

  return (
    <PageContainer>
      <PageHeader
        kicker="Compare briefs"
        title="Weigh opportunities side by side."
        description="The same instruments, lined up — eligibility, explained match, freshness and the source behind each. No blended super-score."
        actions={
          addable.length && selected.length < 3 ? (
            <div className="relative group">
              <Button variant="secondary" icon={<Plus size={16} />}>Add a role</Button>
              <div className="absolute right-0 mt-1 w-72 rounded-[var(--radius-card)] border border-line bg-white shadow-[var(--shadow-sheet)] p-1.5 opacity-0 invisible group-hover:opacity-100 group-hover:visible group-focus-within:opacity-100 group-focus-within:visible transition-opacity z-20 max-h-72 overflow-y-auto scrollbar-thin">
                {addable.map((j) => (
                  <button
                    key={j.slug}
                    onClick={() => setSlugs([...slugs, j.slug])}
                    className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-[var(--radius-control)] hover:bg-soft text-left"
                  >
                    <CompanyLogo name={companyName(j.companySlug)} size={26} />
                    <span className="min-w-0">
                      <span className="block text-[13px] text-ink truncate">{j.title}</span>
                      <span className="block text-[12px] text-slate truncate">{companyName(j.companySlug)}</span>
                    </span>
                  </button>
                ))}
              </div>
            </div>
          ) : undefined
        }
      />

      <div className="overflow-x-auto scrollbar-thin -mx-1 px-1">
        <div
          className="grid gap-4 min-w-[720px]"
          style={{ gridTemplateColumns: `180px repeat(${selected.length}, minmax(240px, 1fr))` }}
        >
          {/* Header row: identity */}
          <div className="pt-2"><Kicker>Opportunity</Kicker></div>
          {selected.map((j) => {
            const company = getCompany(j.companySlug);
            return (
              <div key={j.slug} className="rounded-[var(--radius-card)] border border-line p-4 relative">
                <button
                  onClick={() => setSlugs(slugs.filter((s) => s !== j.slug))}
                  aria-label={`Remove ${j.title}`}
                  className="absolute top-2 right-2 inline-flex items-center justify-center size-7 rounded-full text-slate hover:bg-soft hover:text-red"
                >
                  <X size={15} />
                </button>
                <CompanyLogo name={companyName(j.companySlug)} size={40} />
                <h3 className="mt-2.5 font-semibold text-ink leading-snug pr-6">
                  <Link to={`/app/jobs/${j.slug}`} className="hover:text-indigo">{j.title}</Link>
                </h3>
                <p className="text-[13px] text-slate mt-0.5">{companyName(j.companySlug)}</p>
                {company && <p className="text-[12px] text-slate mt-0.5">{company.sector}</p>}
              </div>
            );
          })}

          {/* Eligibility */}
          <RowLabel>Eligibility</RowLabel>
          {selected.map((j) => (
            <Cell key={j.slug}>
              <EligibilityShield state={j.eligibility.state} reasons={j.eligibility.reasons} variant="detail" />
            </Cell>
          ))}

          {/* Match score + dimensions */}
          <RowLabel>Match</RowLabel>
          {selected.map((j) => (
            <Cell key={j.slug}>
              <MatchBrief data={j.match} variant="full" />
            </Cell>
          ))}

          {/* Location */}
          <RowLabel>Location & model</RowLabel>
          {selected.map((j) => (
            <Cell key={j.slug}>
              <p className="text-sm text-ink inline-flex items-start gap-1.5"><MapPin size={14} className="text-slate mt-0.5 shrink-0" /> {j.locations.join(" · ")}</p>
              <p className="text-[13px] text-slate mt-1">{j.workModel} · {j.seniority} · {j.employmentType}</p>
            </Cell>
          ))}

          {/* Salary */}
          <RowLabel>Salary</RowLabel>
          {selected.map((j) => (
            <Cell key={j.slug}>
              <p className="inline-flex items-start gap-1.5 text-sm">
                <Banknote size={14} className="text-slate mt-0.5 shrink-0" />
                {j.salary ? (
                  <span className={j.salary.provided ? "font-data text-ink" : "font-data text-slate italic"}>
                    {j.salary.text}{!j.salary.provided && " (not employer-provided)"}
                  </span>
                ) : (
                  <span className="text-slate italic">Salary not provided</span>
                )}
              </p>
            </Cell>
          ))}

          {/* Freshness */}
          <RowLabel>Freshness</RowLabel>
          {selected.map((j) => (
            <Cell key={j.slug}>
              <FreshnessTimeline events={j.freshness} variant="expanded" />
            </Cell>
          ))}

          {/* Source / apply */}
          <RowLabel>Source</RowLabel>
          {selected.map((j) => (
            <Cell key={j.slug}>
              <SourceBadge source={j.source} domain={domainFromUrl(j.sourceUrl)} />
              <a href={j.applyUrl} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1.5 font-data text-[12px] text-cyan hover:underline">
                <ExternalLink size={12} /> {domainFromUrl(j.applyUrl)}
              </a>
            </Cell>
          ))}
        </div>
      </div>

      <p className="mt-6 text-[12px] text-slate max-w-2xl">
        RoleBrief compares each dimension separately and never collapses them into a single ranking — you decide which
        signals matter most for your next move.
      </p>
    </PageContainer>
  );
}

function RowLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="pt-4 border-t border-line">
      <span className="text-[13px] font-semibold text-ink">{children}</span>
    </div>
  );
}

function Cell({ children }: { children: React.ReactNode }) {
  return <div className="pt-4 border-t border-line">{children}</div>;
}
