import { BarChart, Bar, ResponsiveContainer, XAxis, Cell } from "recharts";
import { TrendingUp, TrendingDown, Minus, AlertCircle } from "lucide-react";
import type { Company } from "../../lib/core/fixtures";
import { classNames } from "../../lib/core/format";
import { Kicker } from "../../ui/primitives";

// Quiet columns + written interpretation. Declares period, coverage and incomplete data.
// Labels each signal as evidence or inference; never presents future hiring as guaranteed.

const toneMeta = {
  positive: { icon: TrendingUp, klass: "text-emerald", bar: "#047857" },
  caution: { icon: TrendingDown, klass: "text-amber", bar: "#b45309" },
  neutral: { icon: Minus, klass: "text-slate", bar: "#667085" },
  insufficient: { icon: AlertCircle, klass: "text-slate", bar: "#d8dee8" },
} as const;

export function CompanyMomentum({ company, variant = "full" }: { company: Company; variant?: "full" | "strip" }) {
  const { momentum } = company;
  const t = toneMeta[momentum.tone];
  const Icon = t.icon;

  if (variant === "strip") {
    return (
      <div className="flex items-center gap-3">
        <Icon size={16} className={t.klass} />
        <p className="text-[13px] text-ink grow">{momentum.summary}</p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between gap-3 mb-3">
        <div className="flex items-center gap-2">
          <Icon size={18} className={t.klass} />
          <span className={classNames("font-semibold", t.klass)}>Company Momentum</span>
        </div>
        <span className="font-data text-[11px] text-slate">{momentum.coverage}</span>
      </div>

      <p className="text-sm text-ink mb-4">{momentum.summary}</p>

      {momentum.tone !== "insufficient" ? (
        <>
          <Kicker className="mb-2">Active openings by month</Kicker>
          <div className="h-24 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={momentum.series} margin={{ top: 4, right: 0, bottom: 0, left: 0 }}>
                <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "#667085" }} />
                <Bar dataKey="openings" radius={[3, 3, 0, 0]} maxBarSize={36} label={{ position: "top", fontSize: 11, fill: "#667085" }}>
                  {momentum.series.map((_, i) => (
                    <Cell key={i} fill={t.bar} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </>
      ) : (
        <div className="rounded-[var(--radius-card)] border border-dashed border-line bg-soft p-4 text-[13px] text-slate">
          Not enough verified signals in this window to describe a trend.
        </div>
      )}

      <ol className="mt-4 space-y-3">
        {momentum.signals.map((s, i) => (
          <li key={i} className="flex items-start gap-3">
            <span className="mt-1.5 size-1.5 rounded-full bg-line shrink-0" aria-hidden />
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[13px] text-ink">{s.title}</span>
                <span
                  className={classNames(
                    "text-[10px] font-data uppercase tracking-wide px-1.5 py-0.5 rounded",
                    s.basis === "evidence" ? "bg-emerald-tint text-emerald" : "bg-amber-tint text-amber",
                  )}
                >
                  {s.basis}
                </span>
              </div>
              <a href={s.sourceUrl} target="_blank" rel="noreferrer" className="text-[12px] text-cyan hover:underline font-data">
                {s.source} ↗
              </a>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}

