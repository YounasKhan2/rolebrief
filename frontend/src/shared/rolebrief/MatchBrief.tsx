import { Check, Minus, HelpCircle, Lightbulb } from "lucide-react";
import type { MatchBriefData } from "../../lib/jobs/jobs";
import type { MatchBriefDetail, MatchBriefSummary } from "../../lib/jobs/match-briefs";
import { classNames } from "../../lib/core/format";
import { Kicker } from "../../ui/primitives";

function statusTone(status: MatchBriefSummary["status"]) {
  if (status === "STRONG_ALIGNMENT") return { bar: "bg-emerald", text: "text-emerald" };
  if (status === "PARTIAL_ALIGNMENT") return { bar: "bg-indigo", text: "text-indigo" };
  if (status === "LIMITED_ALIGNMENT") return { bar: "bg-amber", text: "text-amber" };
  return { bar: "bg-slate", text: "text-slate" };
}

function DimensionBar({ label, score, note }: { label: string; score: number; note: string }) {
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-[13px] text-ink">{label}</span>
        <span className="font-data text-[12px] text-slate">{score >= 70 ? "Aligned" : score >= 45 ? "Partial" : "Difference"}</span>
      </div>
      <div className="mt-1 h-1.5 rounded-full bg-line/70 overflow-hidden" role="img" aria-label={`${label}: ${note}`}>
        <div className={classNames("h-full rounded-full", score >= 70 ? "bg-emerald" : score >= 45 ? "bg-indigo" : "bg-slate")} style={{ width: `${score}%` }} />
      </div>
      <p className="text-[12px] text-slate mt-1">{note}</p>
    </div>
  );
}

function EvidenceList({ items, icon, klass, label }: { items: string[]; icon: typeof Check; klass: string; label: string }) {
  if (items.length === 0) return null;
  const Icon = icon;
  return (
    <div>
      <Kicker className="mb-2">{label}</Kicker>
      <ul className="space-y-1.5">
        {items.map((t) => (
          <li key={t} className="flex items-start gap-2 text-[13px] text-ink">
            <Icon size={14} className={classNames("mt-0.5 shrink-0", klass)} />
            {t}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function MatchBrief({ data, variant = "compact" }: { data: MatchBriefData; variant?: "compact" | "full" }) {
  if (data.summary) return <LiveMatchBrief summary={data.summary} detail={data.detail} variant={variant} />;

  if (data.score === 0) {
    // No-profile variant
    return (
      <div className="rounded-[var(--radius-card)] border border-line bg-soft p-4">
        <p className="text-sm font-semibold text-ink">Match Brief unavailable</p>
        <p className="text-[13px] text-slate mt-1">{data.ambiguous[0]}</p>
        <p className="text-[13px] text-indigo mt-2">{data.suggestions[0]}</p>
      </div>
    );
  }

  const legacyLabel = data.score >= 80 ? "Strong alignment" : data.score >= 60 ? "Partial alignment" : "Limited alignment";
  const legacyTone = data.score >= 80 ? "text-emerald" : data.score >= 60 ? "text-indigo" : "text-slate";

  if (variant === "compact") {
    return (
      <div className="flex items-center gap-3">
        <div className={classNames("text-[13px] font-medium", legacyTone)}>{legacyLabel}</div>
        <div className="grow">
          <div className="flex items-center justify-between">
            <span className="text-[12px] text-slate">Demo evidence</span>
            <span className="text-[12px] text-slate">{data.evidence[0] ? "See why" : ""}</span>
          </div>
          <div className="mt-1 flex gap-0.5" aria-hidden>
            {data.dimensions.slice(0, 6).map((d) => (
            <span key={d.label} className="h-1 grow rounded-full bg-line/70 overflow-hidden">
                <span className={classNames("block h-full", d.score >= 70 ? "bg-emerald" : d.score >= 45 ? "bg-indigo" : "bg-slate")} style={{ width: `${d.score}%` }} />
              </span>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-end gap-4">
        <div>
          <Kicker className="mb-1">Match Brief</Kicker>
          <div className="flex items-baseline gap-1.5">
            <span className={classNames("text-lg font-semibold", legacyTone)}>{legacyLabel}</span>
            <span className="text-sm text-slate">Demo-only evidence</span>
          </div>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {data.dimensions.map((d) => (
          <DimensionBar key={d.label} {...d} />
        ))}
      </div>

      <div className="grid gap-5 sm:grid-cols-2 pt-2 border-t border-line">
        <EvidenceList items={data.evidence} icon={Check} klass="text-emerald" label="Matching evidence" />
        <EvidenceList items={data.missing} icon={Minus} klass="text-red" label="Missing requirements" />
        <EvidenceList items={data.ambiguous} icon={HelpCircle} klass="text-amber" label="Ambiguous" />
        <EvidenceList items={data.suggestions} icon={Lightbulb} klass="text-indigo" label="Suggestions" />
      </div>
    </div>
  );
}

function LiveMatchBrief({
  summary,
  detail,
  variant
}: {
  summary: MatchBriefSummary;
  detail?: MatchBriefDetail | null;
  variant: "compact" | "full";
}) {
  const tone = statusTone(summary.status);
  const coverage = `${summary.coveragePercent}% evidence coverage`;

  if (variant === "compact") {
    return (
      <div className="flex items-center gap-3" aria-live="polite">
        <div className={classNames("font-medium text-[13px]", tone.text)}>{summary.label}</div>
        <div className="grow min-w-[120px]">
          <div className="flex items-center justify-between gap-3">
            <span className="text-[12px] text-slate">{coverage}</span>
            <span className="text-[12px] text-slate">{summary.status === "NOT_CALCULATED" ? "Profile facts needed" : "Evidence-led"}</span>
          </div>
          <div className="mt-1 h-1.5 rounded-full bg-line/70 overflow-hidden" role="img" aria-label={coverage}>
            <div className={classNames("h-full rounded-full", tone.bar)} style={{ width: `${summary.coveragePercent}%` }} />
          </div>
        </div>
      </div>
    );
  }

  const dimensions = detail?.dimensions ?? [];
  return (
    <div className="space-y-5" aria-live="polite">
      <div>
        <Kicker className="mb-1">Match Brief</Kicker>
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <span className={classNames("text-lg font-semibold", tone.text)}>{summary.label}</span>
          <span className="text-sm text-slate">{coverage}</span>
        </div>
      </div>

      {dimensions.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2">
          {dimensions.map((dimension) => (
            <div key={dimension.dimension} className="rounded-[var(--radius-card)] border border-line p-3">
              <div className="flex items-center justify-between gap-3">
                <p className="text-[13px] font-semibold text-ink">{dimensionLabel(dimension.dimension)}</p>
                <span className={classNames("text-[12px] font-medium", statusTone(summary.status).text)}>{dimension.status.replace("_", " ")}</span>
              </div>
              <p className="mt-2 text-[13px] text-slate">{dimension.explanation}</p>
              <dl className="mt-3 grid gap-2 text-[12px]">
                <div>
                  <dt className="text-slate">{dimension.candidateFact.label}</dt>
                  <dd className="text-ink">{dimension.candidateFact.value}</dd>
                </div>
                <div>
                  <dt className="text-slate">{dimension.jobFact.label}</dt>
                  <dd className="text-ink">{dimension.jobFact.value}</dd>
                </div>
              </dl>
            </div>
          ))}
        </div>
      )}

      <div className="grid gap-5 sm:grid-cols-3 pt-2 border-t border-line">
        <EvidenceList items={summary.strengths.map((i) => i.label)} icon={Check} klass="text-emerald" label="Aligned evidence" />
        <EvidenceList items={summary.gaps.map((i) => i.label)} icon={Minus} klass="text-red" label="Confirmed differences" />
        <EvidenceList items={summary.unknowns.map((i) => i.label)} icon={HelpCircle} klass="text-amber" label="Unknown facts" />
      </div>
    </div>
  );
}

function dimensionLabel(value: string) {
  return value.toLowerCase().replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

