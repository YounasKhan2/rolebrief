import { useState } from "react";
import {
  ShieldCheck,
  ShieldAlert,
  ShieldX,
  ShieldQuestion,
  ChevronDown,
  Info,
  AlertCircle,
  MapPin,
  Clock,
  Briefcase,
  CheckCircle2,
  AlertTriangle
} from "lucide-react";
import type {
  DetailedEligibilityResult,
  DimensionResult,
  EligibilitySummary,
  OverallEligibilityStatus
} from "../../lib/jobs/eligibility";
import type { EligibilityState } from "../../lib/jobs/jobs";
import { classNames } from "../../lib/core/format";

export interface EligibilityShieldProps {
  summary?: EligibilitySummary;
  detail?: DetailedEligibilityResult | null;
  state?: EligibilityState;
  reasons?: { label: string; kind: EligibilityState }[];
  variant?: "compact" | "detail";
  isJobExpired?: boolean;
}

interface StatusStyle {
  label: string;
  icon: typeof ShieldCheck;
  text: string;
  bg: string;
  ring: string;
}

const STATUS_METAS: Record<OverallEligibilityStatus, StatusStyle> = {
  APPEARS_ELIGIBLE: {
    label: "Appears eligible",
    icon: ShieldCheck,
    text: "text-emerald",
    bg: "bg-emerald-tint",
    ring: "border-emerald/30"
  },
  LIKELY_ELIGIBLE: {
    label: "Likely eligible",
    icon: ShieldCheck,
    text: "text-indigo",
    bg: "bg-indigo-tint",
    ring: "border-indigo/30"
  },
  CHECK_REQUIRED: {
    label: "Check required",
    icon: ShieldAlert,
    text: "text-amber",
    bg: "bg-amber-tint",
    ring: "border-amber/30"
  },
  CONFLICT: {
    label: "Eligibility conflict",
    icon: ShieldX,
    text: "text-red",
    bg: "bg-red-tint",
    ring: "border-red/30"
  },
  NOT_CALCULATED: {
    label: "Profile incomplete",
    icon: ShieldQuestion,
    text: "text-slate",
    bg: "bg-soft",
    ring: "border-line"
  }
};

const LEGACY_MAP: Record<EligibilityState, OverallEligibilityStatus> = {
  eligible: "APPEARS_ELIGIBLE",
  check: "CHECK_REQUIRED",
  conflict: "CONFLICT",
  unknown: "NOT_CALCULATED"
};

export function EligibilityShield({
  summary,
  detail,
  state,
  reasons,
  variant = "compact",
  isJobExpired = false
}: EligibilityShieldProps) {
  const [open, setOpen] = useState(variant === "detail");

  // Determine overall status
  const currentStatus: OverallEligibilityStatus =
    detail?.overallStatus ??
    summary?.overallStatus ??
    (state ? LEGACY_MAP[state] : "NOT_CALCULATED");

  const m = STATUS_METAS[currentStatus] || STATUS_METAS.NOT_CALCULATED;
  const Icon = m.icon;
  const badgeLabel = detail?.badgeText ?? summary?.badgeText ?? m.label;
  const headline = detail?.headline ?? summary?.headline ?? "";
  const availability = detail?.jobAvailability ?? summary?.jobAvailability;
  const expired = isJobExpired || availability?.status === "EXPIRED" || availability?.status === "DELISTED" || detail?.isJobExpired;
  const canApply = availability ? availability.canApply : !expired;

  if (variant === "compact") {
    return (
      <div className="inline-flex flex-col gap-1.5 relative">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          onKeyDown={(e) => {
            if (e.key === "Escape") setOpen(false);
          }}
          aria-expanded={open}
          className={classNames(
            "inline-flex items-center gap-1.5 h-8 pl-2.5 pr-2.5 rounded-full border text-[13px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo",
            m.bg,
            m.ring,
            m.text
          )}
        >
          <Icon size={15} />
          <span>{badgeLabel}</span>
          <ChevronDown
            size={13}
            className={classNames("transition-transform duration-200", open && "rotate-180")}
          />
        </button>

        {open && (
          <div
            role="region"
            aria-label="Eligibility details"
            className="rounded-[10px] border border-line bg-white p-3 shadow-md text-[12px] text-ink max-w-xs sm:max-w-sm w-full space-y-1.5 z-10"
          >
            {headline && <div className="font-semibold text-navy">{headline}</div>}
            {reasons && reasons.length > 0 ? (
              <ul className="text-slate space-y-1 pt-1">
                {reasons.map((r) => (
                  <li key={r.label} className="flex gap-1.5 items-start">
                    <span
                      className={classNames(
                        "mt-1 size-1.5 rounded-full shrink-0",
                        r.kind === "eligible" ? "bg-emerald" : r.kind === "conflict" ? "bg-red" : "bg-amber"
                      )}
                    />
                    <span>{r.label}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="text-slate">
                Deterministic evaluation based on candidate profile facts and employer stated restrictions.
              </div>
            )}
            {!canApply && availability?.reason && (
              <div className="text-amber font-medium flex items-center gap-1 pt-1 border-t border-line mt-1">
                <AlertTriangle size={12} className="shrink-0" /> {availability.reason}
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  // Detail variant
  return (
    <div className="rounded-[var(--radius-card)] border border-line bg-white p-5 space-y-4 shadow-sm">
      {/* Overall Header Banner */}
      <div className={classNames("rounded-[10px] border p-4 flex items-start gap-3", m.bg, m.ring)}>
        <Icon size={22} className={classNames("shrink-0 mt-0.5", m.text)} />
        <div>
          <div className={classNames("font-semibold text-base", m.text)}>{badgeLabel}</div>
          <p className="text-[13px] text-slate mt-0.5">
            {headline || "Based on candidate self-reported facts and employer requirements."}
          </p>
          {expired && (
            <div className="mt-2 inline-flex items-center gap-1.5 text-[12px] font-medium text-amber bg-white/70 px-2 py-0.5 rounded-md border border-amber/30">
              <AlertTriangle size={13} />
              Role is expired or delisted; applications may be closed
            </div>
          )}
        </div>
      </div>

      {/* 4 Dimension Breakdown */}
      {detail?.dimensions && detail.dimensions.length > 0 ? (
        <div className="space-y-3 pt-1">
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate">
            Dimension Evaluations
          </div>
          <div className="grid gap-2.5">
            {detail.dimensions.map((dim) => (
              <DimensionRow key={dim.dimension} dimension={dim} />
            ))}
          </div>
        </div>
      ) : reasons && reasons.length > 0 ? (
        <ul className="space-y-2">
          {reasons.map((r) => (
            <li key={r.label} className="flex items-start gap-2 text-sm text-ink">
              <Info size={16} className="mt-0.5 shrink-0 text-slate" />
              <span>{r.label}</span>
            </li>
          ))}
        </ul>
      ) : null}

      {/* Known & Unstated Facts */}
      {detail?.knownFacts && (
        <div className="pt-2 border-t border-line text-[12px] space-y-2">
          <div className="font-semibold text-navy">Evaluation Facts</div>
          <div className="grid grid-cols-2 gap-2 text-slate">
            <div>
              <span className="text-ink font-medium">Candidate Country:</span>{" "}
              {detail.knownFacts.candidateResidenceCountry || "Unspecified"}
            </div>
            <div>
              <span className="text-ink font-medium">Authorizations:</span>{" "}
              {detail.knownFacts.candidateWorkAuthorizations.length > 0
                ? detail.knownFacts.candidateWorkAuthorizations.join(", ")
                : "None declared"}
            </div>
            <div>
              <span className="text-ink font-medium">Allowed Countries:</span>{" "}
              {detail.knownFacts.jobAllowedCountries.length > 0
                ? detail.knownFacts.jobAllowedCountries.join(", ")
                : "Worldwide"}
            </div>
            <div>
              <span className="text-ink font-medium">Timezone Band:</span>{" "}
              {detail.knownFacts.jobTimezoneOffsets.length > 0
                ? detail.knownFacts.jobTimezoneOffsets.map((o) => `UTC${o >= 0 ? "+" : ""}${Math.round(o / 60)}h`).join(", ")
                : "Worldwide"}
            </div>
          </div>
        </div>
      )}

      {/* Unstated Facts Warning */}
      {detail?.unstatedFacts && detail.unstatedFacts.length > 0 && (
        <div className="rounded-md border border-amber/30 bg-amber-tint/50 p-3 text-[12px] text-amber space-y-1">
          <div className="font-semibold flex items-center gap-1.5">
            <AlertCircle size={14} /> Unstated Requirements
          </div>
          <ul className="list-disc pl-4 space-y-0.5">
            {detail.unstatedFacts.map((u) => (
              <li key={u}>{u}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Honest Legal Disclaimer */}
      <div className="pt-2 border-t border-line text-[11px] text-slate leading-relaxed">
        {detail?.disclaimer ||
          "Eligibility Shield evaluations are deterministic estimates based on candidate self-reported facts and employer-stated requirements. They do not constitute legal advice or guarantee employment eligibility."}
      </div>
    </div>
  );
}

function DimensionRow({ dimension }: { dimension: DimensionResult }) {
  const getIcon = () => {
    switch (dimension.dimension) {
      case "LOCATION":
        return <MapPin size={15} />;
      case "TIMEZONE":
        return <Clock size={15} />;
      case "SPONSORSHIP":
        return <Briefcase size={15} />;
      case "ROLE_AUTHENTICITY":
        return <CheckCircle2 size={15} />;
    }
  };

  const getStatusBadge = () => {
    switch (dimension.status) {
      case "SATISFIED":
        return <span className="text-emerald font-semibold text-[11px] uppercase tracking-wider">Satisfied</span>;
      case "LIKELY_SATISFIED":
        return <span className="text-indigo font-semibold text-[11px] uppercase tracking-wider">Likely</span>;
      case "INSUFFICIENT_DATA":
        return <span className="text-amber font-semibold text-[11px] uppercase tracking-wider">Check</span>;
      case "CONFLICT":
        return <span className="text-red font-semibold text-[11px] uppercase tracking-wider">Conflict</span>;
      case "NOT_APPLICABLE":
        return <span className="text-slate font-semibold text-[11px] uppercase tracking-wider">N/A</span>;
    }
  };

  return (
    <div className="rounded-[8px] border border-line bg-soft/40 p-2.5 flex items-start justify-between gap-3">
      <div className="flex items-start gap-2">
        <div className="mt-0.5 text-slate">{getIcon()}</div>
        <div>
          <div className="text-[13px] font-medium text-navy">{dimension.headline}</div>
          <div className="text-[12px] text-slate mt-0.5">{dimension.details}</div>
        </div>
      </div>
      <div className="shrink-0 pt-0.5">{getStatusBadge()}</div>
    </div>
  );
}

