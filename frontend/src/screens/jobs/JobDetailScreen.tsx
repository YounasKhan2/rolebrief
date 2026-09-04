import { useState } from "react";
import { useParams, Link } from "react-router";
import {
  ExternalLink,
  Bookmark,
  BookmarkCheck,
  ListChecks,
  Flag,
  ShieldAlert,
  ChevronRight,
} from "lucide-react";
import { PageContainer } from "../../components/shell/AppShell";
import { Button, Kicker, Badge, CompanyLogo, SourceBadge, SectionRule, EmptyState } from "../../components/ui/primitives";
import { EligibilityShield } from "../../components/rolebrief/EligibilityShield";
import { MatchBrief } from "../../components/rolebrief/MatchBrief";
import { FreshnessTimeline } from "../../components/rolebrief/FreshnessTimeline";
import { JobMetaRow, ReasonChips } from "../../components/rolebrief/JobCard";
import { NewsCard } from "../../components/rolebrief/NewsCard";
import { JobCard } from "../../components/rolebrief/JobCard";
import { getJob, jobs, news, companyName, getCompany } from "../../lib/fixtures";
import { domainFromUrl } from "../../lib/format";
import { useToast } from "../../components/ui/toast";

export function Component() {
  const { slug } = useParams();
  const toast = useToast();
  const job = getJob(slug ?? "");
  const [saved, setSaved] = useState(false);

  if (!job) {
    return (
      <PageContainer>
        <EmptyState title="Role not found" body="This listing may have expired or moved." action={<Link to="/jobs" className="text-indigo font-medium">Back to jobs</Link>} />
      </PageContainer>
    );
  }

  const company = getCompany(job.companySlug);
  const expired = job.flags?.includes("expired");
  const suspicious = job.flags?.includes("suspicious");
  const domain = domainFromUrl(job.applyUrl);
  const related = news.filter((n) => n.companies.includes(job.companySlug));
  const similar = jobs.filter((j) => j.slug !== job.slug && j.discipline === job.discipline && !j.flags?.includes("expired")).slice(0, 2);

  const applyBar = (
    <>
      <Button
        variant="secondary"
        onClick={() => { setSaved((s) => !s); toast({ kind: saved ? "info" : "success", message: saved ? "Removed from saved." : "Saved to your hub." }); }}
        icon={saved ? <BookmarkCheck size={16} className="text-indigo" /> : <Bookmark size={16} />}
      >
        {saved ? "Saved" : "Save"}
      </Button>
      <Button variant="secondary" onClick={() => toast({ kind: "success", message: "Added to tracker as Saved." })} icon={<ListChecks size={16} />}>
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
          <Link to={`/companies/${job.companySlug}`} className="hover:text-ink">{companyName(job.companySlug)}</Link>
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
                <CompanyLogo name={companyName(job.companySlug)} size={52} />
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

            <Section title="Overview"><p className="text-ink/85 reading-measure">{job.description.overview}</p></Section>
            <Section title="Responsibilities"><Bullets items={job.description.responsibilities} /></Section>
            <Section title="Required"><Bullets items={job.description.required} /></Section>
            <Section title="Preferred"><Bullets items={job.description.preferred} /></Section>
            <Section title="Benefits"><Bullets items={job.description.benefits} /></Section>
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

            {related.length > 0 && (
              <div className="mt-10">
                <h2 className="text-lg font-semibold text-ink mb-4">Related company news</h2>
                <NewsCard item={related[0]} variant="standard" />
              </div>
            )}

            {similar.length > 0 && (
              <div className="mt-10">
                <h2 className="text-lg font-semibold text-ink mb-4">Similar eligible roles</h2>
                <div className="space-y-4">
                  {similar.map((j) => <JobCard key={j.slug} job={j} variant="compact" />)}
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
            {company && (
              <div className="rounded-[var(--radius-card)] border border-line p-5">
                <Kicker className="mb-2">About {company.name}</Kicker>
                <div className="flex items-center gap-2 mb-2">
                  <Badge tone="slate">{company.sector}</Badge>
                  <Badge tone="slate">{company.sizeBand}</Badge>
                </div>
                <Link to={`/companies/${company.slug}`} className="text-[13px] text-indigo font-medium inline-flex items-center gap-1">
                  Company Momentum <ChevronRight size={14} />
                </Link>
              </div>
            )}
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

function Bullets({ items }: { items: string[] }) {
  return (
    <ul className="space-y-2 reading-measure">
      {items.map((t) => (
        <li key={t} className="flex items-start gap-2.5 text-ink/85">
          <span className="mt-2 size-1.5 rounded-full bg-indigo shrink-0" aria-hidden />
          {t}
        </li>
      ))}
    </ul>
  );
}
