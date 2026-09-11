import { useEffect, useState, useCallback } from "react";
import { Link } from "react-router";
import { Bookmark, Bell, Building2, RefreshCw } from "lucide-react";
import { PageContainer, PageHeader } from "../../components/shell/AppShell";
import { EmptyState, Button } from "../../components/ui/primitives";
import { Tabs } from "../../components/ui/form";
import CandidateJobCard from "../../components/candidate/CandidateJobCard";
import CandidateJobSkeleton from "../../components/candidate/CandidateJobSkeleton";
import "../../components/candidate/candidate-pipeline.css";
import { useSaved } from "../../lib/saved-context";
import { fetchSavedJobs } from "../../lib/saved-api";
import { mapApiJob, type Job } from "../../lib/jobs";
import { useToast } from "../../components/ui/toast";

type Tab = "jobs" | "searches" | "companies";

export function Component() {
  const [tab, setTab] = useState<Tab>("jobs");
  const { unsave, save } = useSaved();
  const toast = useToast();

  const [savedJobs, setSavedJobs] = useState<Job[]>([]);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasNextPage, setHasNextPage] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadJobs = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetchSavedJobs({ limit: 20 });
      const mapped = (res.data || []).map(mapApiJob);
      setSavedJobs(mapped);
      setNextCursor(res.pageInfo?.nextCursor ?? null);
      setHasNextPage(Boolean(res.pageInfo?.hasNextPage));
      setTotalCount(res.totalCount ?? mapped.length);
    } catch (err: any) {
      setError(err?.message || "Could not load saved jobs.");
    } finally {
      setLoading(false);
    }
  }, []);

  const loadMore = async () => {
    if (!nextCursor || loadingMore) return;
    try {
      setLoadingMore(true);
      const res = await fetchSavedJobs({ cursor: nextCursor, limit: 20 });
      const mapped = (res.data || []).map(mapApiJob);
      setSavedJobs((prev) => [...prev, ...mapped]);
      setNextCursor(res.pageInfo?.nextCursor ?? null);
      setHasNextPage(Boolean(res.pageInfo?.hasNextPage));
    } catch (err: any) {
      toast({ kind: "error", message: err?.message || "Could not load more saved jobs." });
    } finally {
      setLoadingMore(false);
    }
  };

  useEffect(() => {
    void loadJobs();
  }, [loadJobs]);

  const handleUnsave = async (job: Job) => {
    const success = await unsave(job.slug);
    if (success) {
      setSavedJobs((prev) => prev.filter((j) => j.slug !== job.slug));
      setTotalCount((prev) => Math.max(0, prev - 1));
      toast({
        kind: "info",
        message: `Removed "${job.title}" from saved briefs.`,
        undo: async () => {
          const restored = await save(job.slug);
          if (restored) {
            setSavedJobs((prev) => [job, ...prev]);
            setTotalCount((prev) => prev + 1);
          }
        },
      });
    }
  };

  return (
    <PageContainer className="candidate-pipeline candidate-saved">
      <PageHeader
        title="Saved"
        description="Roles you kept for review, comparison, or later action."
        actions={<Link className="candidate-control" to="/app/tracker">Open tracker</Link>}
      />

      <div className="mb-6">
        <Tabs
          value={tab}
          onChange={setTab}
          tabs={[
            { value: "jobs", label: "Jobs", count: totalCount },
            { value: "searches", label: "Searches", count: 0 },
            { value: "companies", label: "Companies", count: 0 },
          ]}
        />
      </div>

      {tab === "jobs" && (
        <>
          {loading ? (
            <CandidateJobSkeleton />
          ) : error ? (
            <EmptyState
              title="Could not load saved jobs"
              body={error}
              action={
                <Button variant="secondary" onClick={loadJobs} icon={<RefreshCw size={14} />}>
                  Retry
                </Button>
              }
            />
          ) : savedJobs.length === 0 ? (
            <EmptyState
              icon={<Bookmark size={40} />}
              title="No saved jobs yet"
              body="Bookmark roles from search or job details to keep them here for action."
              action={<Link to="/app/jobs" className="text-indigo font-medium">Browse jobs</Link>}
            />
          ) : (
            <div className="space-y-4">
              {savedJobs.map((job) => (
                <CandidateJobCard
                  key={job.slug}
                  job={{ ...job, saved: true }}
                  onUnsave={() => handleUnsave(job)}
                />
              ))}

              {hasNextPage && (
                <div className="pt-4 flex justify-center">
                  <Button
                    variant="secondary"
                    onClick={loadMore}
                    loading={loadingMore}
                  >
                    Load more saved briefs
                  </Button>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {tab === "searches" && (
        <EmptyState
          icon={<Bell size={40} />}
          title="No saved searches yet"
          body="Saved searches and alerts remain unavailable until their backend phase."
        />
      )}
      {tab === "companies" && (
        <EmptyState
          icon={<Building2 size={40} />}
          title="No followed companies yet"
          body="Followed-company persistence is not implemented in this phase."
        />
      )}
    </PageContainer>
  );
}
