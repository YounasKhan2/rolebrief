import { useParams, Link } from "react-router";
import { ExternalLink, ChevronRight, TrendingUp, TrendingDown, Minus, HelpCircle, Plus } from "lucide-react";
import { PageContainer } from "../../shared/shell/AppShell";
import { Kicker, Badge, SectionRule, Button, EmptyState, CompanyLogo } from "../../ui/primitives";
import { JobCard } from "../../shared/rolebrief/JobCard";
import { getNews, getJob, companyName } from "../../lib/core/fixtures";
import { formatDate } from "../../lib/core/format";
import { useToast } from "../../ui/toast";

const impactMeta = {
  "Likely more hiring": { icon: TrendingUp, klass: "text-emerald" },
  "Likely fewer roles": { icon: TrendingDown, klass: "text-red" },
  "Mixed signal": { icon: Minus, klass: "text-amber" },
  Unclear: { icon: HelpCircle, klass: "text-slate" },
} as const;

export function Component() {
  const { slug } = useParams();
  const toast = useToast();
  const item = getNews(slug ?? "");

  if (!item) {
    return (
      <PageContainer>
        <EmptyState title="Story not found" body="This item may have been removed." action={<Link to="/app/news" className="text-indigo font-medium">Back to Market Pulse</Link>} />
      </PageContainer>
    );
  }

  const Impact = impactMeta[item.hiringImpact.label].icon;
  const impactKlass = impactMeta[item.hiringImpact.label].klass;
  const relatedJobs = item.relatedJobs.map(getJob).filter(Boolean);

  return (
    <PageContainer className="max-w-[900px]">
      <nav className="flex items-center gap-1.5 text-[13px] text-slate mb-6" aria-label="Breadcrumb">
        <Link to="/app/news" className="hover:text-ink">Market Pulse</Link>
        <ChevronRight size={13} />
        <span className="text-cyan">{item.category}</span>
      </nav>

      <Kicker className="mb-3 text-cyan">{item.category}</Kicker>
      <h1 className="font-display text-4xl sm:text-5xl leading-tight text-navy">{item.headline}</h1>
      <div className="mt-4 flex flex-wrap items-center gap-3 text-[13px] text-slate">
        <span className="font-data">{item.publisher}</span>
        <span>·</span>
        <span className="font-data">{formatDate(item.publishedAt)}</span>
        <a href={item.sourceUrl} target="_blank" rel="noreferrer" className="text-cyan hover:underline inline-flex items-center gap-1">
          Read at source <ExternalLink size={12} />
        </a>
      </div>

      {item.image && (
        <div className="mt-6 rounded-[var(--radius-feature)] overflow-hidden bg-soft h-64 sm:h-80">
          <img src={item.image} alt="" className="size-full object-cover" />
        </div>
      )}

      {/* AI summary — clearly labelled */}
      <div className="mt-6 rounded-[var(--radius-card)] border border-cyan/30 bg-cyan-tint p-5">
        <div className="flex items-center gap-2 mb-2">
          <Badge tone="cyan">AI-generated summary</Badge>
        </div>
        <p className="text-ink/85">{item.summary}</p>
      </div>

      <SectionRule className="my-8" />

      <div className="grid sm:grid-cols-2 gap-8">
        <div>
          <Kicker className="mb-3">Key facts · from the source</Kicker>
          <ul className="space-y-2">
            {item.keyFacts.map((f) => (
              <li key={f} className="flex items-start gap-2.5 text-ink/85">
                <span className="mt-2 size-1.5 rounded-full bg-cyan shrink-0" aria-hidden />
                {f}
              </li>
            ))}
          </ul>
        </div>
        <div>
          <Kicker className="mb-3">RoleBrief's interpretation</Kicker>
          <div className="rounded-[var(--radius-card)] border border-line p-4">
            <div className="flex items-center gap-2 mb-1.5">
              <Impact size={16} className={impactKlass} />
              <span className={`font-medium ${impactKlass}`}>{item.hiringImpact.label}</span>
            </div>
            <p className="text-[13px] text-slate">{item.hiringImpact.rationale}</p>
          </div>
          <p className="text-[12px] text-slate mt-2">This is analysis, not a forecast or a guarantee of future hiring.</p>
        </div>
      </div>

      {/* Affected companies & locations */}
      <div className="mt-8 flex flex-wrap items-center gap-4">
        {item.companies.map((c) => (
          <Link key={c} to={`/companies/${c}`} className="inline-flex items-center gap-2 text-sm text-ink hover:text-indigo">
            <CompanyLogo name={companyName(c)} size={28} /> {companyName(c)}
          </Link>
        ))}
        <div className="grow" />
        <Button variant="secondary" size="sm" icon={<Plus size={15} />} onClick={() => toast({ kind: "success", message: `Following ${companyName(item.companies[0])}.` })}>
          Follow {companyName(item.companies[0])}
        </Button>
      </div>

      {relatedJobs.length > 0 && (
        <div className="mt-10">
          <h2 className="text-lg font-semibold text-ink mb-4">Related active roles</h2>
          <div className="space-y-4">
            {relatedJobs.map((j) => j && <JobCard key={j.slug} job={j} variant="compact" />)}
          </div>
        </div>
      )}
    </PageContainer>
  );
}
