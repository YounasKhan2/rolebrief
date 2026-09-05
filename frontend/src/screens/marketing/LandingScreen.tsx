import { Link } from "react-router";
import { useState } from "react";
import {
  ArrowRight,
  ShieldCheck,
  Radar as RadarIcon,
  Clock,
  TrendingUp,
  Check,
  ChevronDown,
  MapPin,
  Bell,
  FileSearch,
  ExternalLink,
} from "lucide-react";
import { LinkButton, Kicker, Badge, CompanyLogo, EmptyState, Skeleton } from "../../components/ui/primitives";
import { JobCard } from "../../components/rolebrief/JobCard";
import { useJobs, type Job } from "../../lib/jobs";
import { classNames } from "../../lib/format";

export function Component() {
  const { data: jobs, loading, error, retry } = useJobs({ limit: 6 });
  return (
    <>
      <Hero jobsCount={jobs.length} loading={loading} />
      <LiveStrip />
      <Signals />
      <StoryBlock jobs={jobs} loading={loading} error={error?.message ?? null} onRetry={retry} />
      <Coverage />
      <Trust />
      <Workflow />
      <AlertValue />
      <Faq />
      <FinalCta jobs={jobs} />
    </>
  );
}

const KINETIC_EDITORIAL_ITEMS = [
  {
    lead: "The right opportunity",
    accent: "shouldn't arrive late",
    tag: "01 // PRINCIPLE",
  },
  {
    lead: "100% source-linked evidence",
    accent: "behind every line",
    tag: "VERIFIED",
  },
  {
    lead: "No ghost jobs,",
    accent: "zero fabricated scarcity",
    tag: "INTEGRITY",
  },
  {
    lead: "Uncertainty labelled",
    accent: "plainly and honestly",
    tag: "EVIDENCE-LED",
  },
  {
    lead: "Stored provider roles,",
    accent: "not sample listings",
    tag: "LIVE DATA",
    isEmerald: true,
  },
  {
    lead: "Coverage across",
    accent: "Pakistan · UAE · Worldwide Remote",
    tag: "GEOGRAPHY",
  },
  {
    lead: "Direct employer applications,",
    accent: "zero recruiter spam",
    tag: "NO MIDDLEMEN",
  },
  {
    lead: "Employer-provided",
    accent: "salary disclosure only",
    tag: "TRANSPARENCY",
  },
];

function Hero({ jobsCount, loading }: { jobsCount: number; loading: boolean }) {
  const stats = [
    { value: loading ? "..." : String(jobsCount), label: "Stored live roles" },
    { value: "1", label: "Connected provider" },
    { value: "0", label: "News providers" },
  ];

  return (
    <section className="relative overflow-hidden bg-paper">
      {/* Soft decorative blurs */}
      <div
        className="absolute -top-40 -right-28 w-[600px] h-[600px] rounded-full opacity-[0.35] blur-[120px]"
        style={{ background: "radial-gradient(circle, #4f46e5, transparent 70%)" }}
        aria-hidden
      />
      <div
        className="absolute -bottom-24 -left-40 w-[500px] h-[500px] rounded-full opacity-[0.25] blur-[100px]"
        style={{ background: "radial-gradient(circle, #0e7490, transparent 70%)" }}
        aria-hidden
      />
      <div
        className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[400px] h-[400px] rounded-full opacity-[0.12] blur-[90px]"
        style={{ background: "radial-gradient(circle, #4f46e5, transparent 70%)" }}
        aria-hidden
      />

      {/* Paper grain */}
      <div className="absolute inset-0 paper-grain opacity-60" aria-hidden />

      {/* Centered content */}
      <div className="relative mx-auto max-w-[950px] px-5 sm:px-8 pt-16 pb-20 lg:pt-36 lg:pb-28 text-center flex flex-col items-center">
        {/* Kicker badge */}
        {/* <div
          className="animate-fade-in-up mb-7 inline-flex items-center gap-2.5 rounded-full bg-indigo-tint border border-indigo/15 px-4 py-2"
        >
          <span className="relative flex size-2">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald opacity-75" />
            <span className="relative inline-flex size-2 rounded-full bg-emerald" />
          </span>
          <span className="font-data text-[11px] tracking-[0.14em] uppercase text-indigo">
            Indexing fresh roles now
          </span>
        </div> */}

        {/* Display heading */}
        <h1
          className="animate-fade-in-up font-display text-[44px] leading-[48px] sm:text-[58px] sm:leading-[62px] lg:text-[72px] lg:leading-[76px] text-navy tracking-tight text-balance"
          style={{ animationDelay: "0.08s" }}
        >
          Your career deserves a{" "}
          <span
            className="bg-clip-text text-transparent animate-shimmer"
            style={{
              backgroundImage:
                "linear-gradient(90deg, #4f46e5, #0e7490, #4f46e5)",
              backgroundSize: "200% 100%",
            }}
          >
            daily briefing
          </span>
          , not a job board.
        </h1>

        {/* Subtext */}
        <p
          className="animate-fade-in-up mt-6 text-[17px] sm:text-lg text-slate leading-relaxed reading-measure mx-auto"
          style={{ animationDelay: "0.16s" }}
        >
          RoleBrief scans thousands of fresh roles, checks your eligibility, scores
          your fit, and delivers a concise ranked brief source-linked, freshness-stamped,
          uncertainty labelled. Every single day.
        </p>

        {/* CTA buttons */}
        <div
          className="animate-fade-in-up mt-9 flex flex-wrap items-center justify-center gap-3"
          style={{ animationDelay: "0.24s" }}
        >
          <LinkButton to="/signup" size="lg" icon={<ArrowRight size={18} />}>
            Build my opportunity brief
          </LinkButton>
          <LinkButton to="/jobs" variant="secondary" size="lg">
            Explore fresh jobs
          </LinkButton>
        </div>

        {/* Trust line */}
        <div
          className="animate-fade-in-up mt-8 flex flex-wrap items-center justify-center gap-5 text-[13px] text-slate"
          style={{ animationDelay: "0.32s" }}
        >
          {[
            { icon: ExternalLink, text: "Source-linked" },
            { icon: Clock, text: "Freshness-checked" },
            { icon: ShieldCheck, text: "Uncertainty labelled" },
          ].map((t) => (
            <span key={t.text} className="inline-flex items-center gap-1.5">
              <t.icon size={14} className="text-cyan" />
              {t.text}
            </span>
          ))}
        </div>

        {/* Stats */}
        <div
          className="animate-fade-in-up mt-14 grid grid-cols-3 gap-8 sm:gap-16 border-t border-line pt-10 w-full max-w-lg"
          style={{ animationDelay: "0.4s" }}
        >
          {stats.map((s) => (
            <div key={s.label} className="text-center">
              <p className="font-display text-3xl sm:text-4xl text-navy">{s.value}</p>
              <p className="mt-1 text-[12px] text-slate font-data">{s.label}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function LiveStrip() {
  const items = [...KINETIC_EDITORIAL_ITEMS, ...KINETIC_EDITORIAL_ITEMS];

  return (
    <div className="relative py-8 -my-3 overflow-hidden pointer-events-none select-none z-20">
      {/* Tilted editorial ribbon extending comfortably beyond viewport */}
      <div
        className="w-[130vw] -ml-[15vw] bg-navy border-y border-white/10 shadow-[0_14px_34px_rgba(15,23,42,0.28)] py-3.5 sm:py-4 pointer-events-auto flex items-center relative transform-gpu"
        style={{ transform: "rotate(-1.4deg)" }}
      >
        {/* Subtle luminous highlight lines */}
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-400/35 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-indigo-400/25 to-transparent" />

        {/* Kinetic marquee track: flowing smoothly right-to-left */}
        <div className="flex animate-marquee-editorial w-max items-center">
          {items.map((item, i) => (
            <div key={`${item.lead}-${i}`} className="inline-flex items-center whitespace-nowrap">
              <span className="font-serif text-[17px] sm:text-[20px] tracking-tight text-white/90">
                {item.lead}{" "}
                <span className={classNames("italic font-normal font-serif", item.isEmerald ? "text-emerald-300" : "text-cyan-300")}>
                  {item.accent}
                </span>
              </span>
              <span className="font-data text-[10px] tracking-[0.14em] uppercase text-white/50 px-2 py-0.5 rounded border border-white/10 bg-white/[0.06] ml-3.5 select-none font-medium">
                {item.tag}
              </span>
              <span className="text-indigo-300/30 text-[10px] mx-7 select-none">✦</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

const signals = [
  {
    icon: RadarIcon,
    name: "RoleBrief Radar",
    tone: "indigo" as const,
    body: "A personalized ranked stream of jobs, hiring news and followed-company activity — roughly 80% roles, 20% signals — each with a plain reason it reached you.",
  },
  {
    icon: ShieldCheck,
    name: "Eligibility Shield",
    tone: "emerald" as const,
    body: "Eligible, check required, conflict or unknown — based on location, remote scope, experience and authorization, always with the evidence and the uncertainty.",
  },
  {
    icon: FileSearch,
    name: "Match Brief",
    tone: "indigo" as const,
    body: "An explainable compatibility view: which skills match, what's missing, what's ambiguous and how to improve. Never an unexplained percentage.",
  },
  {
    icon: Clock,
    name: "Freshness Timeline",
    tone: "cyan" as const,
    body: "When a role was published, discovered, verified and last rechecked — so you know how fresh a listing really is before you spend time on it.",
  },
  {
    icon: TrendingUp,
    name: "Company Momentum",
    tone: "cyan" as const,
    body: "Active roles connected to source-linked hiring, funding, office and policy news — clearly labelled as evidence or inference, never a promise of future hiring.",
  },
];

function Signals() {
  return (
    <section id="signals" className="scroll-mt-20">
      <div className="mx-auto max-w-[1260px] px-5 sm:px-8 py-20">
        <div className="max-w-3xl">
          <Kicker className="mb-3">The signature system</Kicker>
          <h2 className="font-display text-4xl text-navy leading-tight">Five instruments that turn noise into a decision.</h2>
          <p className="mt-4 text-ink/75">
            The same five signals sit in consistent places across Radar, Jobs, Saved and every job page — so you learn
            to read an opportunity at a glance.
          </p>
        </div>

        <div className="mt-12 grid gap-px bg-line rounded-[var(--radius-feature)] overflow-hidden md:grid-cols-2 lg:grid-cols-3">
          {signals.map((s, i) => (
            <div
              key={s.name}
              id={i === 0 ? "radar" : undefined}
              className={classNames(
                "bg-paper p-7 flex flex-col scroll-mt-20",
                i === 0 && "lg:col-span-1 md:col-span-2",
              )}
            >
              <span className={classNames("inline-flex size-11 items-center justify-center rounded-[12px] mb-5",
                s.tone === "emerald" ? "bg-emerald-tint text-emerald" : s.tone === "cyan" ? "bg-cyan-tint text-cyan" : "bg-indigo-tint text-indigo")}>
                <s.icon size={22} />
              </span>
              <h3 className="text-lg font-semibold text-ink">{s.name}</h3>
              <p className="mt-2 text-[15px] text-slate leading-relaxed">{s.body}</p>
            </div>
          ))}
          <div className="bg-navy p-7 flex flex-col justify-between text-paper">
            <p className="font-display text-2xl leading-snug">Read the fit. Trust the source. Act early.</p>
            <Link to="/signup" className="mt-6 inline-flex items-center gap-2 text-paper font-medium hover:gap-3 transition-all">
              See a live Radar <ArrowRight size={18} />
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

function StoryBlock({ jobs, loading, error, onRetry }: { jobs: Job[]; loading: boolean; error: string | null; onRetry: () => void }) {
  return (
    <section className="bg-white border-y border-line">
      <div className="mx-auto max-w-[1248px] px-5 sm:px-8 py-20 grid lg:grid-cols-2 gap-12 items-start">
        <div>
          <Kicker className="mb-3">Jobs and the news around them</Kicker>
          <h2 className="font-display text-4xl text-navy leading-tight">
            A role means more when you can see the company's momentum.
          </h2>
          <p className="mt-4 text-ink/75 reading-measure">
            RoleBrief reads career-relevant news — funding, hiring, new offices, layoffs, remote and visa policy — and
            links it to the roles it affects. Signals are labelled as evidence or inference, and we never reproduce full
            articles.
          </p>
          <div className="mt-6 space-y-3">
            {loading && Array.from({ length: 2 }).map((_, index) => (
              <Skeleton key={index} className="h-36 w-full rounded-[var(--radius-card)]" />
            ))}
            {!loading && !error && jobs.slice(0, 2).map((j) => (
              <JobCard key={j.slug} job={j} variant="compact" />
            ))}
            {!loading && error && (
              <EmptyState title="Jobs API unavailable" body={error} action={<button className="text-indigo font-medium" onClick={onRetry}>Retry</button>} />
            )}
            {!loading && !error && jobs.length === 0 && (
              <EmptyState title="No stored jobs yet" body="Run the Himalayas provider sync, then refresh to see live provider roles here." />
            )}
          </div>
        </div>
        <div className="space-y-4">
          <EmptyState
            title="Company momentum unavailable"
            body="News ingestion is not connected to live backend data yet, so RoleBrief does not infer funding, hiring, deadline or momentum claims here."
          />
        </div>
      </div>
    </section>
  );
}

function Coverage() {
  const regions = [
    { place: "Himalayas", detail: "Connected provider", note: "Stored roles are read from the backend Jobs API." },
    { place: "Company enrichment", detail: "Unavailable", note: "Momentum and company intelligence stay labelled until a backend source exists." },
    { place: "Remote metadata", detail: "Provider supplied", note: "Missing restrictions are shown as unavailable rather than inferred." },
  ];
  return (
    <section id="coverage" className="scroll-mt-20">
      <div className="mx-auto max-w-[1248px] px-5 sm:px-8 py-20">
        <div className="flex flex-wrap items-end justify-between gap-4 mb-10">
          <div>
            <Kicker className="mb-3">Where we look</Kicker>
            <h2 className="font-display text-4xl text-navy">Focused coverage, honestly scoped.</h2>
          </div>
          <p className="text-slate max-w-sm">We start where we can be genuinely useful, and we tell you when a market's data is thin.</p>
        </div>
        <div className="grid gap-6 md:grid-cols-3">
          {regions.map((r) => (
            <div key={r.place} className="rounded-[var(--radius-card)] border border-line bg-white p-6">
              <MapPin size={20} className="text-cyan mb-4" />
              <h3 className="text-lg font-semibold text-ink">{r.place}</h3>
              <p className="font-data text-[12px] text-slate mt-1">{r.detail}</p>
              <p className="text-[14px] text-slate mt-3">{r.note}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Trust() {
  const points = [
    "Every listing links back to its original source and destination domain.",
    "Freshness is stamped: published, discovered, verified and rechecked.",
    "AI-generated summaries and inferred fields are always labelled.",
    "No fake scarcity, fabricated deadlines or hidden sponsored ranking.",
  ];
  return (
    <section id="trust" className="scroll-mt-20 bg-navy text-paper">
      <div className="mx-auto max-w-[1248px] px-5 sm:px-8 py-20 grid lg:grid-cols-[0.9fr_1.1fr] gap-12">
        <div>
          <Kicker className="mb-3 text-paper/60">Trust by construction</Kicker>
          <h2 className="font-display text-4xl leading-tight">We'd rather say "we don't know" than guess.</h2>
        </div>
        <ul className="grid sm:grid-cols-2 gap-x-8 gap-y-5">
          {points.map((p) => (
            <li key={p} className="flex items-start gap-3">
              <Check size={18} className="text-emerald mt-0.5 shrink-0" />
              <span className="text-paper/85">{p}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

const steps = [
  { n: "01", title: "Build your brief", body: "Tell us your target roles, reach and fit. A résumé is optional — you stay in control of every inferred field." },
  { n: "02", title: "Read your Radar", body: "A ranked, personalized stream with reasons, eligibility and freshness on every card." },
  { n: "03", title: "Decide with evidence", body: "Open a role to see the Match Brief, Eligibility Shield and the company's momentum, side by side." },
  { n: "04", title: "Track and stay ahead", body: "Apply on the company's own site, mark it in your tracker, and let Smart Alerts surface the next fresh match." },
];

function Workflow() {
  return (
    <section className="bg-white border-y border-line">
      <div className="mx-auto max-w-[1248px] px-5 sm:px-8 py-20">
        <Kicker className="mb-3">The candidate workflow</Kicker>
        <h2 className="font-display text-4xl text-navy mb-12">From noise to your next move, in four steps.</h2>
        <ol className="grid gap-x-8 gap-y-10 md:grid-cols-2 lg:grid-cols-4">
          {steps.map((s) => (
            <li key={s.n} className="relative pt-6 border-t-2 border-ink">
              <span className="font-data text-[13px] text-indigo absolute -top-3 bg-white pr-3">{s.n}</span>
              <h3 className="text-lg font-semibold text-ink">{s.title}</h3>
              <p className="mt-2 text-[15px] text-slate">{s.body}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

function AlertValue() {
  return (
    <section className="mx-auto max-w-[1248px] px-5 sm:px-8 py-20">
      <div className="rounded-[var(--radius-feature)] bg-paper border border-line p-8 lg:p-12 grid lg:grid-cols-[1fr_auto] gap-8 items-center">
        <div className="max-w-xl">
          <span className="inline-flex items-center gap-2 kicker mb-3"><Bell size={13} className="text-indigo" /> Smart Alerts</span>
          <h2 className="font-display text-3xl text-navy leading-tight">Describe the role you want. We'll watch for it.</h2>
          <p className="mt-3 text-ink/75">
            Start in plain language, refine the parsed chips, preview real matches and choose instant, daily or weekly —
            with quiet hours you control.
          </p>
        </div>
        <LinkButton to="/signup" size="lg" icon={<ArrowRight size={18} />}>
          Create an alert
        </LinkButton>
      </div>
    </section>
  );
}

const faqs = [
  { q: "Do you post the jobs yourselves?", a: "No. We index roles from company sites and job boards, link back to the source, and send you to the employer's own site to apply." },
  { q: "How accurate is the eligibility check?", a: "It's guidance, not a guarantee. We show the evidence behind Eligible, Check required, Conflict or Unknown — and we mark what the employer didn't specify." },
  { q: "Is a résumé required?", a: "Never. A résumé can improve your Match Brief, but you can build a full profile by hand and edit every inferred field." },
  { q: "Where does the career news come from?", a: "Published sources, summarized and clearly labelled as AI-generated. We separate sourced facts from RoleBrief's interpretation and never reproduce full articles." },
];

function Faq() {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <section className="bg-white border-t border-line">
      <div className="mx-auto max-w-[820px] px-5 sm:px-8 py-20">
        <Kicker className="mb-3">Questions</Kicker>
        <h2 className="font-display text-4xl text-navy mb-8">Straight answers.</h2>
        <div className="divide-y divide-line border-y border-line">
          {faqs.map((f, i) => (
            <div key={f.q}>
              <button
                onClick={() => setOpen(open === i ? null : i)}
                aria-expanded={open === i}
                className="w-full flex items-center justify-between gap-4 py-5 text-left"
              >
                <span className="text-lg font-medium text-ink">{f.q}</span>
                <ChevronDown size={20} className={classNames("text-slate transition-transform shrink-0", open === i && "rotate-180")} />
              </button>
              {open === i && <p className="pb-5 -mt-1 text-slate reading-measure">{f.a}</p>}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function FinalCta({ jobs }: { jobs: Job[] }) {
  const indexedCompanies = Array.from(new Map(jobs.map((job) => [job.companySlug, job.companyName])).entries()).slice(0, 4);

  return (
    <section className="bg-paper">
      <div className="mx-auto max-w-[1248px] px-5 sm:px-8 py-24 text-center">
        <Badge tone="indigo">Free to start</Badge>
        <h2 className="mt-5 font-display text-5xl text-navy leading-tight max-w-3xl mx-auto">
          Start reading opportunities like a briefing.
        </h2>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <LinkButton to="/signup" size="lg" icon={<ArrowRight size={18} />}>
            Build my opportunity brief
          </LinkButton>
          <LinkButton to="/jobs" variant="secondary" size="lg">
            Explore fresh jobs
          </LinkButton>
        </div>
        <div className="mt-12 flex flex-wrap items-center justify-center gap-6 opacity-80">
          {indexedCompanies.map(([slug, name]) => (
            <span key={slug} className="inline-flex items-center gap-2 text-[13px] text-slate">
              <CompanyLogo name={name} size={24} /> {name}
            </span>
          ))}
        </div>
        <p className="mt-3 text-[12px] text-slate">
          {indexedCompanies.length > 0 ? "Companies currently stored from the backend Jobs API." : "No provider companies are stored yet."}
        </p>
      </div>
    </section>
  );
}
