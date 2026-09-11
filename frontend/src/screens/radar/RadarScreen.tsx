import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router";
import {
  ArrowDown,
  ArrowRight,
  ArrowUpRight,
  AlertCircle,
  Bookmark,
  BriefcaseBusiness,
  CalendarClock,
  Check,
  Clock3,
  Loader2,
  Radar,
  RefreshCw,
  SlidersHorizontal,
  Sparkles,
} from "lucide-react";
import { useRadarFeed, type RadarSummary } from "../../lib/radar-api";
import { getPreferences } from "../../lib/preferences-api";
import CandidateJobCard from "../../components/candidate/CandidateJobCard";
import RadarSkeleton from "../../components/candidate/CandidateJobSkeleton";
import { displayDate } from "../../components/candidate/radar-presentation";

type Lens = "Relevance" | "Freshest" | "No known eligibility conflicts";

export function Component() {
  const [params, setParams] = useSearchParams();
  const lens: Lens =
    params.get("eligibility") === "no-known-conflicts"
      ? "No known eligibility conflicts"
      : params.get("sort") === "freshest"
        ? "Freshest"
        : "Relevance";
  const {
    data: jobs,
    summary,
    loading,
    loadingMore,
    error,
    notice,
    appendedAnnouncement,
    hasNextPage,
    loadMore,
    retry,
  } = useRadarFeed({
    limit: 20,
    sort: lens === "Freshest" ? "freshest" : "relevance",
    eligibility:
      lens === "No known eligibility conflicts"
        ? "NO_KNOWN_CONFLICTS"
        : "INCLUDE_ALL",
  });
  const sentinel = useRef<HTMLDivElement>(null);
  const [timezone, setTimezone] = useState<string>("UTC");
  const [retryUntil, setRetryUntil] = useState(0);
  const [waitSeconds, setWaitSeconds] = useState(0);
  useEffect(() => {
    if (notice?.includes("snapshot expired"))
      window.scrollTo({ top: 0, behavior: "instant" });
  }, [notice]);
  useEffect(() => {
    let alive = true;
    getPreferences()
      .then((result) => {
        if (alive) setTimezone(result.preferences.timezone || "UTC");
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);
  useEffect(() => {
    if (error?.status === 429)
      setRetryUntil(Date.now() + (error.retryAfterSeconds || 60) * 1000);
    else setRetryUntil(0);
  }, [error]);
  useEffect(() => {
    if (!retryUntil) {
      setWaitSeconds(0);
      return;
    }
    const tick = () =>
      setWaitSeconds(Math.max(0, Math.ceil((retryUntil - Date.now()) / 1000)));
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [retryUntil]);
  useEffect(() => {
    const target = sentinel.current;
    if (
      !target ||
      !hasNextPage ||
      loading ||
      loadingMore ||
      error ||
      typeof IntersectionObserver === "undefined"
    )
      return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) loadMore();
      },
      { rootMargin: "320px", threshold: 0.1 },
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, [hasNextPage, loading, loadingMore, error, loadMore]);
  function setLens(next: Lens) {
    const updated = new URLSearchParams(params);
    updated.delete("sort");
    updated.delete("eligibility");
    if (next === "Freshest") updated.set("sort", "freshest");
    if (next === "No known eligibility conflicts")
      updated.set("eligibility", "no-known-conflicts");
    setParams(updated, { replace: true });
    window.scrollTo({ top: 0, behavior: "instant" });
  }
  const retryDisabled = waitSeconds > 0 || loading;
  return (
    <div className="radar-workspace">
      <header className="radar-page-header">
        <div>
          <div className="radar-title-line">
            <span className="radar-title-icon">
              <Radar size={20} strokeWidth={1.5} />
            </span>
            <h1>Radar</h1>
          </div>
          <p>A ranked workspace for roles worth reviewing.</p>
        </div>
        <button
          className="candidate-control radar-refresh"
          onClick={retry}
          disabled={retryDisabled}
        >
          <RefreshCw size={14} className={loading ? "candidate-spin" : ""} />
          {loading ? "Updating feed" : "Refresh feed"}
        </button>
      </header>
      <div className="radar-layout">
        <section className="radar-feed" aria-label="Radar opportunities">
          <div className="radar-feed-toolbar">
            <div className="radar-feed-tab">
              <Radar size={14} />
              <span>Opportunities</span>
              {!loading && (
                <span className="radar-loaded-count">{jobs.length}</span>
              )}
            </div>
            <label className="radar-lens">
              <SlidersHorizontal size={13} />
              <span className="sr-only">Preference lens</span>
              <select
                value={lens}
                onChange={(e) => setLens(e.target.value as Lens)}
                aria-label="Preference lens"
              >
                <option>Relevance</option>
                <option>Freshest</option>
                <option>No known eligibility conflicts</option>
              </select>
            </label>
          </div>
          <div className="radar-feed-caption">
            <span>
              {lens === "Freshest"
                ? "Most recently discovered first"
                : lens === "No known eligibility conflicts"
                  ? "Appears eligible or likely eligible"
                  : "Your preferences. The evidence. Your decision."}
            </span>
            <Link to="/app/profile">
              Edit preferences <ArrowUpRight size={12} />
            </Link>
          </div>
          {notice && (
            <div className="radar-notice" role="status">
              <AlertCircle size={16} />
              <p>{notice}</p>
            </div>
          )}
          <div className="sr-only" aria-live="polite" aria-atomic="true">
            {appendedAnnouncement}
          </div>
          {loading ? (
            <RadarSkeleton />
          ) : (
            <>
              {error && (
                <div className="radar-notice radar-error" role="alert">
                  <AlertCircle size={18} />
                  <div>
                    <strong>
                      {error.status === 429
                        ? "A moment before your next update"
                        : "We couldn't load the next opportunities"}
                    </strong>
                    <p>{error.message}</p>
                    {waitSeconds > 0 && (
                      <p>Try again in {waitSeconds} seconds.</p>
                    )}
                  </div>
                  <button
                    className="candidate-control"
                    onClick={jobs.length ? loadMore : retry}
                    disabled={retryDisabled}
                  >
                    Retry
                  </button>
                </div>
              )}
              {jobs.length === 0 && !error && (
                <div className="radar-empty">
                  <Radar size={30} strokeWidth={1.2} />
                  <h2>Make room for more possibilities.</h2>
                  <p>
                    {lens === "Relevance"
                      ? "No opportunities are in this feed yet. Review your preferences or browse Jobs for a wider view."
                      : "No roles match this lens right now. Return to Relevance to include all eligibility states."}
                  </p>
                  <div>
                    <button
                      className="candidate-control"
                      onClick={() =>
                        lens === "Relevance" ? retry() : setLens("Relevance")
                      }
                    >
                      {lens === "Relevance" ? "Refresh feed" : "Reset lens"}
                    </button>
                    <Link to="/app/jobs">
                      Browse jobs <ArrowUpRight size={14} />
                    </Link>
                  </div>
                </div>
              )}
              <div className="radar-job-list">
                {jobs.map((job) => (
                <CandidateJobCard key={job.slug} job={job} timezone={timezone} />
                ))}
              </div>
              {hasNextPage && !error && (
                <div
                  ref={sentinel}
                  className="radar-sentinel"
                  aria-hidden="true"
                />
              )}
              {loadingMore && <RadarSkeleton count={2} />}
              {hasNextPage && jobs.length > 0 && (
                <div className="radar-pagination">
                  <button
                    className="candidate-control"
                    onClick={loadMore}
                    disabled={loadingMore || retryDisabled}
                  >
                    {loadingMore ? (
                      <Loader2 size={14} className="candidate-spin" />
                    ) : (
                      <ArrowDown size={14} />
                    )}{" "}
                    {loadingMore
                      ? "Loading more opportunities"
                      : error
                        ? "Retry loading opportunities"
                        : "Load more opportunities"}
                  </button>
                </div>
              )}
              {!hasNextPage && !loadingMore && !error && jobs.length > 0 && (
                <div className="radar-feed-end">
                  <Check size={15} />
                  <span>
                    You've reviewed this feed. Refresh for a new view.
                  </span>
                </div>
              )}
            </>
          )}
        </section>
        <RadarRail
          summary={summary}
          loading={loading}
          timezone={timezone}
          titles={new Map(jobs.map((job) => [job.slug, job.title]))}
        />
      </div>
    </div>
  );
}


function RadarRail({
  summary,
  loading,
  timezone,
  titles,
}: {
  summary: RadarSummary | null;
  loading: boolean;
  timezone: string;
  titles: Map<string, string>;
}) {
  return (
    <aside className="radar-rail" aria-label="Your activity">
      <div className="radar-rail-heading">
        <span>Your activity</span>
        <Link to="/app/tracker" aria-label="Open application tracker">
          <ArrowUpRight size={14} />
        </Link>
      </div>
      <div className="radar-metrics">
        <Link to="/app/saved" className="radar-metric metric-saved">
          <span className="radar-metric-label">
            <Bookmark size={15} />
            Saved jobs
          </span>
          <strong className="radar-metric-value">
            {loading ? "..." : (summary?.savedJobs ?? "Unavailable")}
          </strong>
        </Link>
        <Link to="/app/tracker" className="radar-metric metric-tracked">
          <span className="radar-metric-label">
            <BriefcaseBusiness size={15} />
            Active applications
          </span>
          <strong className="radar-metric-value">
            {loading ? "..." : (summary?.activeApplications ?? "Unavailable")}
          </strong>
        </Link>
      </div>
      <section className="radar-new-roles">
        <div>
          <span className="radar-rail-icon">
            <Sparkles size={16} />
          </span>
          <h2>New in your Radar</h2>
          <strong>
            {loading ? "..." : (summary?.newRadarRoles ?? "Unavailable")}
          </strong>
        </div>
        <p>
          Discovered in the last seven days.
          <br />
          Within your current feed.
        </p>
      </section>
      <section className="radar-rail-section">
        <div className="radar-rail-section-title">
          <CalendarClock size={15} />
          <h2>Upcoming actions</h2>
          <span>14 days</span>
        </div>
        {!summary ? (
          <p>
            {loading
              ? "Loading your next steps..."
              : "Upcoming actions are unavailable."}
          </p>
        ) : summary.upcomingActions.length === 0 ? (
          <div className="radar-quiet-state">
            <Clock3 size={18} />
            <p>
              No upcoming actions.
              <br />
              <Link to="/app/tracker">
                Plan your next step in Tracker <ArrowRight size={12} />
              </Link>
            </p>
          </div>
        ) : (
          <ol className="radar-action-list">
            {summary.upcomingActions.map((action) => (
              <li key={action.id}>
                <time dateTime={action.nextActionAt || undefined}>
                  {action.nextActionAt
                    ? displayDate(action.nextActionAt, timezone)
                    : "Date not set"}
                </time>
                <Link to="/app/tracker">
                  <strong>{action.nextAction || "Review application"}</strong>
                  <span>{action.roleTitle}</span>
                </Link>
              </li>
            ))}
          </ol>
        )}
      </section>
      <section className="radar-rail-section">
        <div className="radar-rail-section-title">
          <Clock3 size={15} />
          <h2>Employer deadlines</h2>
        </div>
        {!summary ? (
          <p>
            {loading
              ? "Checking deadlines..."
              : "Deadline information unavailable."}
          </p>
        ) : summary.employerDeadlines.length === 0 ? (
          <p>No upcoming employer deadlines in this feed.</p>
        ) : (
          <ol className="radar-action-list">
            {summary.employerDeadlines.map((item) => (
              <li key={item.slug}>
                <time dateTime={item.deadlineAt}>
                  {displayDate(item.deadlineAt, timezone)}
                </time>
                <Link to={`/app/jobs/${encodeURIComponent(item.slug)}`}>
                  <strong>
                    {titles.get(item.slug) || "Review role deadline"}
                  </strong>
                </Link>
              </li>
            ))}
          </ol>
        )}
        <small>Dates shown in {timezone}.</small>
      </section>
      <Link to="/app/alerts" className="radar-alert-link">
        <SlidersHorizontal size={15} />
        <div>
          <strong>Make updates work for you</strong>
          <span>Review your alert preferences</span>
        </div>
        <ArrowUpRight size={14} />
      </Link>
      <div className="radar-evidence-note">
        <ShieldIcon />
        <p>
          Alignment and eligibility are separate signals. Your decision stays
          yours.
        </p>
        <Link to="/sources-methodology">
          How we read the evidence <ArrowUpRight size={12} />
        </Link>
      </div>
    </aside>
  );
}
function ShieldIcon() {
  return <span className="radar-small-rule" />;
}
