import { useState } from "react";
import { useParams, Link } from "react-router";
import { Globe, MapPin, Plus, Check, ChevronRight, Briefcase } from "lucide-react";
import { PageContainer } from "../../components/shell/AppShell";
import { Kicker, Badge, Button, CompanyLogo, SectionRule, EmptyState } from "../../components/ui/primitives";
import { CompanyMomentum } from "../../components/rolebrief/CompanyMomentum";
import { JobCard } from "../../components/rolebrief/JobCard";
import { NewsCard } from "../../components/rolebrief/NewsCard";
import { getCompany, jobs, news, disciplines } from "../../lib/fixtures";
import { domainFromUrl } from "../../lib/format";

export function Component() {
  const { slug } = useParams();
  const company = getCompany(slug ?? "");
  const [following, setFollowing] = useState(true);

  if (!company) {
    return (
      <PageContainer>
        <EmptyState title="Company not found" body="We may not index this company yet." action={<Link to="/jobs" className="text-indigo font-medium">Back to jobs</Link>} />
      </PageContainer>
    );
  }

  const openRoles = jobs.filter((j) => j.companySlug === company.slug && !j.flags?.includes("expired"));
  const eligibleCount = openRoles.filter((j) => j.eligibility.state === "eligible").length;
  const relatedNews = news.filter((n) => n.companies.includes(company.slug));
  const categoryCounts = disciplines
    .map((d) => ({ d, n: openRoles.filter((j) => j.discipline === d).length }))
    .filter((x) => x.n > 0);

  return (
    <PageContainer>
      {/* Identity */}
      <div className="flex flex-wrap items-start gap-5">
        <CompanyLogo name={company.name} size={64} />
        <div className="grow min-w-0">
          <h1 className="font-display text-4xl text-navy">{company.name}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Badge tone="slate">{company.sector}</Badge>
            <Badge tone="slate">{company.sizeBand} people</Badge>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-4 text-[13px] text-slate">
            <a href={company.website} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-cyan hover:underline font-data">
              <Globe size={14} /> {domainFromUrl(company.website)}
            </a>
            <span className="inline-flex items-center gap-1.5"><MapPin size={14} /> {company.hq}</span>
          </div>
        </div>
        <Button
          variant={following ? "secondary" : "primary"}
          onClick={() => setFollowing((f) => !f)}
          icon={following ? <Check size={16} /> : <Plus size={16} />}
        >
          {following ? "Following" : "Follow"}
        </Button>
      </div>

      <p className="mt-5 text-ink/80 reading-measure">{company.about}</p>

      {/* Candidate-specific summary */}
      <div className="mt-6 rounded-[var(--radius-card)] border border-indigo/20 bg-indigo-tint/60 p-4 flex flex-wrap items-center gap-x-6 gap-y-2">
        <span className="inline-flex items-center gap-2 text-sm text-ink">
          <Briefcase size={16} className="text-indigo" />
          <span className="font-semibold font-data">{openRoles.length}</span> active roles
        </span>
        <span className="text-sm text-ink"><span className="font-semibold font-data text-emerald">{eligibleCount}</span> look eligible for you</span>
        <div className="grow" />
        <span className="text-[12px] text-slate">Locations: {company.locations.join(" · ")}</span>
      </div>

      <div className="mt-8 grid lg:grid-cols-[1fr_340px] gap-8 items-start">
        <div className="space-y-8">
          <div>
            <h2 className="text-lg font-semibold text-ink mb-4">Open roles</h2>
            {openRoles.length === 0 ? (
              <div className="rounded-[var(--radius-card)] border border-dashed border-line p-6 text-slate text-sm">
                No active roles right now. Follow to hear when they open.
              </div>
            ) : (
              <div className="space-y-4">
                {openRoles.map((j) => <JobCard key={j.slug} job={j} variant="comfortable" />)}
              </div>
            )}
          </div>

          {relatedNews.length > 0 && (
            <div>
              <h2 className="text-lg font-semibold text-ink mb-4">Relevant news</h2>
              <NewsCard item={relatedNews[0]} variant="standard" />
            </div>
          )}
        </div>

        <aside className="space-y-6 lg:sticky lg:top-20">
          <div className="rounded-[var(--radius-feature)] border border-line p-5">
            <CompanyMomentum company={company} variant="full" />
          </div>

          <div className="rounded-[var(--radius-card)] border border-line p-5">
            <Kicker className="mb-3">Job categories</Kicker>
            {categoryCounts.length ? (
              <ul className="space-y-2">
                {categoryCounts.map(({ d, n }) => (
                  <li key={d} className="flex items-center justify-between text-sm">
                    <span className="text-ink">{d}</span>
                    <span className="font-data text-slate">{n}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-[13px] text-slate">No open categories.</p>
            )}
            <SectionRule className="my-4" />
            <Link to="/jobs" className="text-[13px] text-indigo font-medium inline-flex items-center gap-1">
              See all in Jobs <ChevronRight size={14} />
            </Link>
          </div>

          {company.momentum.tone === "insufficient" && (
            <div className="rounded-[var(--radius-card)] border border-amber/30 bg-amber-tint p-4 text-[13px] text-ink">
              We have limited recent data on {company.name}. Treat the momentum view as provisional.
            </div>
          )}
        </aside>
      </div>
    </PageContainer>
  );
}
