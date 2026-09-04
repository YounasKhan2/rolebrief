import { useState } from "react";
import { ShieldCheck, ShieldAlert, ShieldX, ShieldQuestion, ChevronDown } from "lucide-react";
import type { EligibilityState } from "../../lib/fixtures";
import { classNames } from "../../lib/format";

// Status always uses icon + text + color together (never color alone). Never claims
// guaranteed qualification — the label wording stays cautious.

const meta: Record<
  EligibilityState,
  { label: string; icon: typeof ShieldCheck; text: string; bg: string; ring: string }
> = {
  eligible: { label: "Eligible", icon: ShieldCheck, text: "text-emerald", bg: "bg-emerald-tint", ring: "border-emerald/30" },
  check: { label: "Check required", icon: ShieldAlert, text: "text-amber", bg: "bg-amber-tint", ring: "border-amber/30" },
  conflict: { label: "Conflict", icon: ShieldX, text: "text-red", bg: "bg-red-tint", ring: "border-red/30" },
  unknown: { label: "Unknown", icon: ShieldQuestion, text: "text-slate", bg: "bg-soft", ring: "border-line" },
};

export function EligibilityShield({
  state,
  reasons,
  variant = "compact",
}: {
  state: EligibilityState;
  reasons: { label: string; kind: EligibilityState }[];
  variant?: "compact" | "detail";
}) {
  const [open, setOpen] = useState(variant === "detail");
  const m = meta[state];
  const Icon = m.icon;

  if (variant === "compact") {
    return (
      <div className="inline-flex flex-col gap-1.5">
        <button
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className={classNames(
            "inline-flex items-center gap-1.5 h-8 pl-2 pr-2.5 rounded-full border text-[13px] font-medium",
            m.bg,
            m.ring,
            m.text,
          )}
        >
          <Icon size={15} />
          {m.label}
          <ChevronDown size={13} className={classNames("transition-transform", open && "rotate-180")} />
        </button>
        {open && (
          <ul className="text-[12px] text-slate space-y-0.5 pl-1">
            {reasons.map((r) => (
              <li key={r.label} className="flex gap-1.5">
                <span className={classNames("mt-1 size-1 rounded-full shrink-0", meta[r.kind].bg)} aria-hidden />
                {r.label}
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  }

  return (
    <div className={classNames("rounded-[var(--radius-card)] border p-4", m.ring, m.bg)}>
      <div className="flex items-center gap-2">
        <Icon size={20} className={m.text} />
        <span className={classNames("font-semibold", m.text)}>{m.label}</span>
      </div>
      <p className="text-[13px] text-slate mt-1">
        Based on the evidence below. This is guidance, not a guarantee of qualification.
      </p>
      <ul className="mt-3 space-y-1.5">
        {reasons.map((r) => {
          const rm = meta[r.kind];
          const RIcon = rm.icon;
          return (
            <li key={r.label} className="flex items-start gap-2 text-sm text-ink">
              <RIcon size={15} className={classNames("mt-0.5 shrink-0", rm.text)} />
              {r.label}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
