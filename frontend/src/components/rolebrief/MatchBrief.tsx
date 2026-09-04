import { Check, Minus, HelpCircle, Lightbulb } from "lucide-react";
import type { MatchBriefData } from "../../lib/fixtures";
import { classNames } from "../../lib/format";
import { Kicker } from "../ui/primitives";

// Never shows an unexplained percentage. The number is always accompanied by dimension
// bars and evidence. Bars carry a textual value for screen readers (spec §7.4).

function scoreTone(score: number) {
  if (score >= 80) return { label: "Strong match", bar: "bg-emerald", text: "text-emerald" };
  if (score >= 60) return { label: "Partial match", bar: "bg-indigo", text: "text-indigo" };
  return { label: "Low match", bar: "bg-slate", text: "text-slate" };
}

function DimensionBar({ label, score, note }: { label: string; score: number; note: string }) {
  const tone = scoreTone(score);
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-[13px] text-ink">{label}</span>
        <span className="font-data text-[12px] text-slate">{score}/100</span>
      </div>
      <div className="mt-1 h-1.5 rounded-full bg-line/70 overflow-hidden" role="img" aria-label={`${label}: ${score} out of 100. ${note}`}>
        <div className={classNames("h-full rounded-full", tone.bar)} style={{ width: `${score}%` }} />
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

  const tone = scoreTone(data.score);

  if (variant === "compact") {
    return (
      <div className="flex items-center gap-3">
        <div className="flex items-baseline gap-1">
          <span className={classNames("font-data text-xl font-medium", tone.text)}>{data.score}</span>
          <span className="text-[12px] text-slate">/100</span>
        </div>
        <div className="grow">
          <div className="flex items-center justify-between">
            <span className={classNames("text-[13px] font-medium", tone.text)}>{tone.label}</span>
            <span className="text-[12px] text-slate">{data.evidence[0] ? "See why" : ""}</span>
          </div>
          <div className="mt-1 flex gap-0.5" aria-hidden>
            {data.dimensions.slice(0, 6).map((d) => (
              <span key={d.label} className="h-1 grow rounded-full bg-line/70 overflow-hidden">
                <span className={classNames("block h-full", scoreTone(d.score).bar)} style={{ width: `${d.score}%` }} />
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
            <span className={classNames("font-data text-4xl font-medium", tone.text)}>{data.score}</span>
            <span className="text-sm text-slate">/100 · {tone.label}</span>
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
