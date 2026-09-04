import { useState } from "react";
import { Clock, Search, CheckCircle2, RefreshCw, Pencil, XOctagon, ChevronDown } from "lucide-react";
import type { FreshnessEvent } from "../../lib/fixtures";
import { relativeTime, formatDate, classNames } from "../../lib/format";

const kindMeta = {
  published: { label: "Published", icon: Clock, klass: "text-slate" },
  discovered: { label: "Discovered by RoleBrief", icon: Search, klass: "text-cyan" },
  verified: { label: "Verified", icon: CheckCircle2, klass: "text-emerald" },
  rechecked: { label: "Rechecked", icon: RefreshCw, klass: "text-cyan" },
  updated: { label: "Updated", icon: Pencil, klass: "text-indigo" },
  expired: { label: "Expired", icon: XOctagon, klass: "text-red" },
} as const;

export function FreshnessTimeline({ events, variant = "compact" }: { events: FreshnessEvent[]; variant?: "compact" | "expanded" }) {
  const [open, setOpen] = useState(variant === "expanded");
  const latest = [...events].sort((a, b) => +new Date(b.at) - +new Date(a.at))[0];
  const expired = events.some((e) => e.kind === "expired");
  const lm = kindMeta[latest.kind];

  if (variant === "compact" && !open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 text-[12px] font-data text-slate hover:text-ink transition-colors"
      >
        <lm.icon size={13} className={expired ? "text-red" : lm.klass} />
        <span className={expired ? "text-red" : ""}>
          {lm.label} {relativeTime(latest.at)}
        </span>
        <ChevronDown size={12} />
      </button>
    );
  }

  return (
    <div>
      {variant === "compact" && (
        <button onClick={() => setOpen(false)} className="inline-flex items-center gap-1.5 text-[12px] font-data text-slate mb-2">
          Freshness timeline <ChevronDown size={12} className="rotate-180" />
        </button>
      )}
      <ol className="relative pl-5">
        <span className="absolute left-[7px] top-1 bottom-1 w-px bg-line" aria-hidden />
        {events.map((e, i) => {
          const m = kindMeta[e.kind];
          const Icon = m.icon;
          return (
            <li key={i} className="relative pb-3 last:pb-0">
              <span className="absolute -left-5 top-0 bg-white rounded-full">
                <Icon size={15} className={m.klass} />
              </span>
              <div className="flex items-baseline justify-between gap-3">
                <span className={classNames("text-[13px] font-medium", e.kind === "expired" ? "text-red" : "text-ink")}>
                  {m.label}
                </span>
                <span className="font-data text-[11px] text-slate shrink-0" title={formatDate(e.at)}>
                  {relativeTime(e.at)}
                </span>
              </div>
              {e.note && <p className="text-[12px] text-slate">{e.note}</p>}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
