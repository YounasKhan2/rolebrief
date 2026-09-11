import { Link } from "react-router";
import {
  ShieldCheck,
  Clock,
  FileSearch,
  TrendingUp,
  Database,
  Copy,
  ExternalLink,
  AlertCircle,
  Check,
  ArrowRight,
} from "lucide-react";
import { PageContainer, PageHeader } from "../../shared/shell/AppShell";
import { Kicker, Badge, SectionRule, LinkButton } from "../../ui/primitives";

const sources = [
  { name: "Himalayas", kind: "Provider API", note: "Canonical jobs are stored by the backend and read through /api/v1/jobs." },
];

const freshnessStages = [
  { icon: Clock, label: "Published", text: "The date the employer or source posted the role." },
  { icon: FileSearch, label: "Discovered", text: "When RoleBrief first indexed it." },
  { icon: Check, label: "Verified", text: "We confirmed the apply link is still live." },
  { icon: TrendingUp, label: "Rechecked", text: "Periodic re-verification; expiry is stamped when a listing disappears." },
];

const eligibilityStates = [
  { tone: "emerald" as const, label: "Eligible", text: "The stated requirements match your profile — location, remote scope, experience and authorization." },
  { tone: "amber" as const, label: "Check required", text: "Something needs your judgement, e.g. hybrid attendance or a seniority stretch." },
  { tone: "red" as const, label: "Conflict", text: "A stated requirement contradicts your preferences, e.g. on-site vs remote-only." },
  { tone: "slate" as const, label: "Unknown", text: "The employer didn't specify. We say so rather than guess." },
];

export function Component() {
  return (
    <PageContainer className="max-w-[900px]">
      <PageHeader
        kicker="Sources & methodology"
        title="How RoleBrief reaches its conclusions."
        description="Where our data comes from, how we judge freshness and eligibility, and where our confidence ends. Written plainly, because trust is the product."
      />

      {/* Principles */}
      <section className="rounded-[var(--radius-feature)] border border-line bg-soft/40 p-6 mb-10">
        <Kicker className="mb-3">Our commitments</Kicker>
        <ul className="grid sm:grid-cols-2 gap-x-8 gap-y-3">
          {[
            "We link every role back to its original source and apply domain.",
            "We label AI-generated summaries and inferred fields, always.",
            "We separate sourced facts from RoleBrief's interpretation.",
            "We'd rather say “we don't know” than fabricate a number.",
            "We never invent scarcity, deadlines or sponsored ranking.",
            "Eligibility and match are guidance with evidence — not guarantees.",
          ].map((p) => (
            <li key={p} className="flex items-start gap-2.5 text-[15px] text-ink">
              <Check size={17} className="text-emerald mt-0.5 shrink-0" />
              {p}
            </li>
          ))}
        </ul>
      </section>

      {/* Where data comes from */}
      <section className="mb-10">
        <h2 className="text-xl font-semibold text-ink inline-flex items-center gap-2 mb-1">
          <Database size={20} className="text-indigo" /> Where our data comes from
        </h2>
        <p className="text-slate reading-measure mb-5">
          We currently index roles from the Himalayas provider, then store canonical jobs in the backend. We do not post
          jobs ourselves, and we always send you to the original source domain to apply.
        </p>
        <div className="rounded-[var(--radius-card)] border border-line overflow-hidden">
          {sources.map((s, i) => (
            <div key={s.name} className={`flex flex-wrap items-center gap-3 px-5 py-3.5 ${i > 0 ? "border-t border-line" : ""}`}>
              <span className="font-medium text-ink grow min-w-[160px]">{s.name}</span>
              <Badge tone="slate">{s.kind}</Badge>
              <span className="text-[13px] text-slate basis-full sm:basis-auto sm:grow">{s.note}</span>
            </div>
          ))}
        </div>
        <p className="mt-3 text-[12px] text-slate inline-flex items-center gap-1.5">
          <Copy size={13} /> Duplicate detection is handled in the backend before roles are exposed to the frontend.
        </p>
      </section>

      <SectionRule className="my-8" />

      {/* Freshness */}
      <section className="mb-10">
        <h2 className="text-xl font-semibold text-ink inline-flex items-center gap-2 mb-1">
          <Clock size={20} className="text-cyan" /> How we judge freshness
        </h2>
        <p className="text-slate reading-measure mb-5">
          Every listing carries a timeline so you know how current it really is before spending time on it.
        </p>
        <ol className="grid sm:grid-cols-2 gap-4">
          {freshnessStages.map((f) => (
            <li key={f.label} className="rounded-[var(--radius-card)] border border-line p-4">
              <f.icon size={18} className="text-cyan mb-2" />
              <p className="font-medium text-ink">{f.label}</p>
              <p className="text-[13px] text-slate mt-0.5">{f.text}</p>
            </li>
          ))}
        </ol>
      </section>

      <SectionRule className="my-8" />

      {/* Eligibility */}
      <section className="mb-10">
        <h2 className="text-xl font-semibold text-ink inline-flex items-center gap-2 mb-1">
          <ShieldCheck size={20} className="text-emerald" /> How the Eligibility Shield works
        </h2>
        <p className="text-slate reading-measure mb-5">
          Profile-based eligibility is not connected yet. Live provider jobs show Check required or Unknown until the
          backend can compare stated requirements to a real user profile.
        </p>
        <div className="space-y-3">
          {eligibilityStates.map((e) => (
            <div key={e.label} className="flex items-start gap-3 rounded-[var(--radius-card)] border border-line p-4">
              <Badge tone={e.tone}>{e.label}</Badge>
              <p className="text-[14px] text-ink grow">{e.text}</p>
            </div>
          ))}
        </div>
      </section>

      <SectionRule className="my-8" />

      {/* Match & momentum */}
      <section className="mb-10 grid sm:grid-cols-2 gap-6">
        <div>
          <h2 className="text-lg font-semibold text-ink inline-flex items-center gap-2 mb-2">
            <FileSearch size={18} className="text-indigo" /> Match Brief
          </h2>
          <p className="text-[14px] text-slate reading-measure">
            Match scoring is not calculated yet for live provider jobs. The frontend shows Profile required or Not
            calculated instead of fabricating a compatibility score.
          </p>
        </div>
        <div>
          <h2 className="text-lg font-semibold text-ink inline-flex items-center gap-2 mb-2">
            <TrendingUp size={18} className="text-cyan" /> Company Momentum
          </h2>
          <p className="text-[14px] text-slate reading-measure">
            Company momentum is unavailable until live company-news ingestion exists. The frontend keeps the UI section
            visible and labels the missing data instead of inferring funding or hiring movement.
          </p>
        </div>
      </section>

      {/* Limits */}
      <section className="rounded-[var(--radius-card)] border border-amber/30 bg-amber-tint/40 p-5 mb-10">
        <h2 className="text-base font-semibold text-ink inline-flex items-center gap-2 mb-2">
          <AlertCircle size={18} className="text-amber" /> Where our confidence ends
        </h2>
        <ul className="space-y-2 text-[14px] text-ink/90">
          <li>Coverage is limited to stored Himalayas provider jobs until additional providers are implemented.</li>
          <li>AI summaries can miss nuance; we link the source so you can read the original.</li>
          <li>Employers don't always state salary, remote scope or authorization — we show “unknown” rather than assume.</li>
        </ul>
      </section>

      <div className="flex flex-wrap items-center gap-3">
        <LinkButton to="/signup" icon={<ArrowRight size={16} />}>Build your brief</LinkButton>
        <a
          href="mailto:trust@rolebrief.example"
          className="inline-flex items-center gap-1.5 text-[13px] text-indigo font-medium hover:underline"
        >
          Report a data issue <ExternalLink size={13} />
        </a>
      </div>
    </PageContainer>
  );
}
