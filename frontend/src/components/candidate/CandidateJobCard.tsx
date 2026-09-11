import { useEffect, useRef, useState } from "react";
import { Link } from "react-router";
import {
  ArrowUpRight,
  Banknote,
  Bookmark,
  BookmarkCheck,
  BriefcaseBusiness,
  CalendarClock,
  Check,
  CircleHelp,
  Globe2,
  Loader2,
  MapPin,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import type { RadarJob } from "../../lib/radar-api";
import type { Job } from "../../lib/jobs";
import { useSaved } from "../../lib/saved-context";
import { useTracker } from "../../lib/tracker-context";
import { initials } from "../../lib/format";
import {
  evidenceItems,
  displayDate,
  eligibilityTone,
} from "./radar-presentation";

function CompanyLogo({
  name,
  logoUrl,
  size,
}: {
  name: string;
  logoUrl: string | null;
  size: number;
}) {
  const [failed, setFailed] = useState(false);
  return (
    <span
      className="radar-company-logo"
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      {logoUrl && !failed ? (
        <img
          src={logoUrl}
          alt=""
          loading="lazy"
          referrerPolicy="no-referrer"
          onError={() => setFailed(true)}
        />
      ) : (
        initials(name)
      )}
    </span>
  );
}

type CandidateJob = Job &
  Partial<
    Pick<
      RadarJob,
      "saved" | "tracked" | "eligibilitySummary" | "jobAvailability"
    >
  >;

export default function CandidateJobCard({
  job,
  timezone,
  density = "comfortable",
  matchLoading = false,
  eligibilityLoading = false,
  onUnsave,
}: {
  job: CandidateJob;
  timezone?: string;
  density?: "comfortable" | "compact";
  matchLoading?: boolean;
  eligibilityLoading?: boolean;
  onUnsave?: () => Promise<void>;
}) {
  const saved = useSaved();
  const tracker = useTracker();
  const contextSaved = saved.isSaved(job.slug);
  const previousSaved = useRef(contextSaved);
  const [savedState, setSavedState] = useState<boolean | null>(
    contextSaved || job.saved || (job.saved === null ? null : false),
  );
  const [trackedHere, setTrackedHere] = useState(false);
  useEffect(() => {
    if (previousSaved.current !== contextSaved) {
      setSavedState(contextSaved);
      previousSaved.current = contextSaved;
    }
  }, [contextSaved]);
  const application = tracker.applications.find((a) => a.jobSlug === job.slug);
  const tracked = application
    ? application.lifecycle === "ACTIVE"
    : trackedHere || job.tracked;
  const match = job.match.summary;
  const eligibility = job.eligibilitySummary;
  const evidence = evidenceItems(match);
  const discovered = job.freshness.find((item) => item.kind === "discovered");
  const deadline = job.freshness.find((item) => item.kind === "deadline");
  const rolePath = `/app/jobs/${encodeURIComponent(job.slug)}`;
  async function toggleSaved() {
    if (savedState && onUnsave) { await onUnsave(); return; }
    const target = !savedState;
    const success = await (target
      ? saved.save(job.slug)
      : saved.unsave(job.slug));
    if (success) setSavedState(target);
  }
  async function track() {
    const result = await tracker.trackJob(job.slug);
    if (result) setTrackedHere(result.lifecycle === "ACTIVE");
  }
  return (
    <article
      className={`radar-job candidate-job-row${density === "compact" ? " is-compact" : ""}`}
      data-job-slug={job.slug}
      aria-label={`${job.title} at ${job.companyName}`}
    >
      <div className="radar-job-heading">
        <CompanyLogo
          name={job.companyName}
          logoUrl={job.companyLogoUrl}
          size={38}
        />
        <div className="radar-job-identity">
          <div className="radar-company-line">
            <span>{job.companyName}</span>
            {discovered && (
              <time dateTime={discovered.at}>
                Discovered {displayDate(discovered.at, timezone)}
              </time>
            )}
          </div>
          <h2>
            <Link to={rolePath}>{job.title}</Link>
          </h2>
        </div>
        <button
          className={`candidate-icon radar-save${savedState ? " is-saved" : ""}`}
          onClick={() => void toggleSaved()}
          disabled={saved.isPending(job.slug)}
          aria-label={`${savedState ? "Unsave" : "Save"} ${job.title}`}
          aria-pressed={savedState === true}
          title={
            savedState
              ? "Unsave role"
              : savedState === null
                ? "Saved status unavailable"
                : "Save role"
          }
        >
          {saved.isPending(job.slug) ? (
            <Loader2 size={17} className="candidate-spin" />
          ) : savedState ? (
            <BookmarkCheck size={18} />
          ) : (
            <Bookmark size={18} />
          )}
        </button>
      </div>
      <div className="radar-job-facts">
        <span>
          <MapPin size={13} />
          {job.locations.length
            ? job.locations.join(", ")
            : job.remoteRestrictionsText || "Location not specified"}
        </span>
        <span>
          <Globe2 size={13} />
          {job.workModel || "Work mode not specified"}
        </span>
        <span>
          <BriefcaseBusiness size={13} />
          {job.employmentType || "Employment not specified"}
        </span>
        <span>
          <Banknote size={13} />
          {job.salary?.provided ? job.salary.text : "Not disclosed"}
        </span>
      </div>
      <div className="radar-evidence-grid">
        <section className="radar-match" aria-label="Match Brief">
          <div className="radar-evidence-heading">
            <Sparkles size={14} />
            <h3>Match Brief</h3>
            <span
              className={`radar-evidence-status ${match?.status === "STRONG_ALIGNMENT" ? "tone-good" : match?.status === "LIMITED_ALIGNMENT" ? "tone-check" : ""}`}
            >
              {match?.label ||
                (matchLoading ? "Checking evidence" : "Not calculated")}
            </span>
          </div>
          <ul>
            {evidence.length ? (
              evidence.map((item, i) => (
                <li key={`${item.label}-${i}`}>
                  {item.kind === "strength" ? (
                    <Check size={11} />
                  ) : (
                    <CircleHelp size={11} />
                  )}
                  <span>{item.label}</span>
                </li>
              ))
            ) : (
              <li>
                <CircleHelp size={11} />
                <span>
                  {matchLoading
                    ? "Reviewing available role and profile facts."
                    : "Comparable evidence is not available for this role."}
                </span>
              </li>
            )}
          </ul>
        </section>
        <section className="radar-eligibility" aria-label="Eligibility Shield">
          <div className="radar-evidence-heading">
            <ShieldCheck size={14} />
            <h3>Eligibility Shield</h3>
          </div>
          <strong className={eligibilityTone(eligibility?.overallStatus)}>
            {eligibility?.badgeText ||
              (eligibilityLoading ? "Checking facts" : "Unknown")}
          </strong>
          <p>
            {eligibility?.headline ||
              "Eligibility facts are not available for this role."}
          </p>
        </section>
      </div>
      <footer className="radar-job-footer">
        <div className="radar-source-line">
          <span className="radar-source-dot" />
          {job.source || "Source not specified"}
          {job.flags?.includes("expired") && (
            <span className="tone-check">Expired listing</span>
          )}
          {job.flags?.includes("suspicious") && (
            <span className="tone-conflict">Listing requires review</span>
          )}
          {savedState && (
            <span className="radar-state-label">
              <BookmarkCheck size={12} />
              Saved
            </span>
          )}
          {savedState === null && <span>Saved status unknown</span>}
          {deadline && (
            <span className="radar-deadline">
              <CalendarClock size={12} />
              Employer deadline {displayDate(deadline.at, timezone)}
            </span>
          )}
        </div>
        <div className="radar-job-actions">
          {tracked ? (
            <Link to="/app/tracker" className="radar-track is-tracked">
              <Check size={13} />
              Tracked
            </Link>
          ) : (
            <button
              className="radar-track"
              onClick={() => void track()}
              disabled={tracker.isPending(job.slug)}
              title={
                tracked === null
                  ? "Tracking status unavailable; check Tracker"
                  : "Track application"
              }
            >
              {tracker.isPending(job.slug) ? (
                <Loader2 size={13} className="candidate-spin" />
              ) : (
                <BriefcaseBusiness size={13} />
              )}
              Track{tracked === null ? " · status unknown" : ""}
            </button>
          )}
          <Link to={rolePath} className="radar-view">
            View role <ArrowUpRight size={14} />
          </Link>
        </div>
      </footer>
    </article>
  );
}
