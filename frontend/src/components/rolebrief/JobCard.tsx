import { Link } from "react-router";
import {
  MapPin,
  Building2,
  Banknote,
  Bookmark,
  BookmarkCheck,
  EyeOff,
  Flag,
  X,
  Sparkles,
} from "lucide-react";
import type { Job } from "../../lib/jobs";
import { classNames } from "../../lib/format";
import { CompanyLogo, SourceBadge, IconButton, Badge } from "../ui/primitives";
import { EligibilityShield } from "./EligibilityShield";
import { MatchBrief } from "./MatchBrief";
import { FreshnessTimeline } from "./FreshnessTimeline";
import { domainFromUrl } from "../../lib/format";

export function JobMetaRow({ job }: { job: Job }) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[13px] text-slate">
      <span className="inline-flex items-center gap-1.5">
        <Building2 size={14} /> {job.companyName}
      </span>
      <span className="inline-flex items-center gap-1.5">
        <MapPin size={14} /> {job.locations.join(" · ")}
      </span>
      <span>{job.workModel}</span>
      <span>{job.seniority}</span>
      <span>{job.employmentType}</span>
      <span className="inline-flex items-center gap-1.5">
        <Banknote size={14} />
        {job.salary ? (
          <span className={job.salary.provided ? "font-data text-ink" : "font-data text-slate italic"}>
            {job.salary.text}
            {!job.salary.provided && " (not employer-provided)"}
          </span>
        ) : (
          <span className="text-slate italic">Not disclosed</span>
        )}
      </span>
    </div>
  );
}

export function ReasonChips({ reasons }: { reasons: string[] }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {reasons.map((r) => (
        <span
          key={r}
          className="inline-flex items-center gap-1 text-[12px] text-navy bg-indigo-tint/70 rounded-full px-2 py-0.5"
        >
          <Sparkles size={11} className="text-indigo" />
          {r}
        </span>
      ))}
    </div>
  );
}

type Variant = "radar" | "comfortable" | "compact" | "saved" | "preview";

export function JobCard({
  job,
  variant = "comfortable",
  saved,
  onSave,
  onDismiss,
  onHideCompany,
  onReport,
}: {
  job: Job;
  variant?: Variant;
  saved?: boolean;
  onSave?: () => void;
  onDismiss?: () => void;
  onHideCompany?: () => void;
  onReport?: () => void;
}) {
  const expired = job.flags?.includes("expired");
  const compact = variant === "compact";

  return (
    <article
      className={classNames(
        "group relative rounded-[var(--radius-card)] border bg-white transition-[border-color,box-shadow] duration-150",
        "hover:border-ink/25 hover:shadow-[var(--shadow-raised)] focus-within:border-indigo",
        expired ? "border-line opacity-90" : "border-line",
        compact ? "p-4" : "p-5",
      )}
    >
      {expired && (
        <div className="mb-3">
          <Badge tone="red">Expired listing</Badge>
        </div>
      )}
      <div className="flex items-start gap-3.5">
        <CompanyLogo name={job.companyName} size={compact ? 36 : 44} />
        <div className="min-w-0 grow">
          <div className="flex items-start justify-between gap-3">
            <h3 className={classNames("font-semibold text-ink leading-snug", compact ? "text-base" : "text-lg")}>
              <Link to={`/jobs/${job.slug}`} className="hover:text-indigo transition-colors before:absolute before:inset-0">
                {job.title}
              </Link>
            </h3>
            {onSave && (
              <IconButton
                label={saved ? "Saved" : "Save job"}
                onClick={onSave}
                className="relative z-10 size-9 shrink-0"
              >
                {saved ? <BookmarkCheck size={18} className="text-indigo" /> : <Bookmark size={18} />}
              </IconButton>
            )}
          </div>
          <div className="mt-1.5">
            <JobMetaRow job={job} />
          </div>
        </div>
      </div>

      {!compact && (
        <div className="mt-4 grid gap-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <EligibilityShield state={job.eligibility.state} reasons={job.eligibility.reasons} />
            <FreshnessTimeline events={job.freshness} />
          </div>
          <div className="rounded-[10px] bg-soft/70 p-3">
            <MatchBrief data={job.match} variant="compact" />
          </div>
          <ReasonChips reasons={job.reasons} />
        </div>
      )}

      {compact && (
        <div className="mt-3 flex items-center justify-between gap-3">
          <EligibilityShield state={job.eligibility.state} reasons={job.eligibility.reasons} />
          <MatchBrief data={job.match} variant="compact" />
        </div>
      )}

      {(onDismiss || onHideCompany || onReport) && !compact && (
        <div className="relative z-10 mt-4 pt-3 border-t border-line flex items-center gap-1 text-slate">
          <SourceBadge source={job.source} domain={domainFromUrl(job.applyUrl)} />
          <div className="grow" />
          {onDismiss && (
            <button onClick={onDismiss} className="inline-flex items-center gap-1 text-[12px] hover:text-ink px-2 py-1 rounded">
              <X size={13} /> Dismiss
            </button>
          )}
          {onHideCompany && (
            <button onClick={onHideCompany} className="inline-flex items-center gap-1 text-[12px] hover:text-ink px-2 py-1 rounded">
              <EyeOff size={13} /> Hide company
            </button>
          )}
          {onReport && (
            <button onClick={onReport} className="inline-flex items-center gap-1 text-[12px] hover:text-red px-2 py-1 rounded">
              <Flag size={13} /> Report
            </button>
          )}
        </div>
      )}
    </article>
  );
}
