import { useEffect, useState, useCallback } from "react";
import { Link } from "react-router";
import { Bookmark, Bell, Building2, RefreshCw } from "lucide-react";
import { PageContainer, PageHeader } from "../../components/shell/AppShell";
import { EmptyState, Button } from "../../components/ui/primitives";
import { Tabs } from "../../components/ui/form";
import { JobCard } from "../../components/rolebrief/JobCard";
import { useSaved } from "../../lib/saved-context";
import { fetchSavedJobs } from "../../lib/saved-api";
import { mapApiJob, type Job } from "../../lib/jobs";
import { useToast } from "../../components/ui/toast";

type Tab = "jobs" | "searches" | "companies";

export function Component() {
  const [tab, setTab] = useState<Tab>("jobs");
  const { savedSlugs, unsave, save } = useSaved();
  const toast = useToast();

  const [savedJobs, setSavedJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadJobs = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetchSavedJobs();
      const mapped = (res.data || []).map(mapApiJob);
      setSavedJobs(mapped);
    } catch (err: any) {
      setError(err?.message || "Could not load saved jobs.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadJobs();
  }, [loadJobs]);

  const handleUnsave = async (job: Job) => {
    const success = await unsave(job.slug);
    if (success) {
      setSavedJobs((prev) => prev.filter((j) => j.slug !== job.slug));
      toast({
        kind: "info",
        message: `Removed "${job.title}" from saved briefs.`,
        undo: async () => {
          const restored = await save(job.slug);
          if (restored) {
            setSavedJobs((prev) => [job, ...prev]);
          }
        },
      });
    }
  };

  return (
    <PageContainer>
      <PageHeader
        kicker="Saved Briefs"
        title="Everything you kept for action."
        description="Review, organize, and act on roles you've bookmarked."
      />

      <div className="mb-6">
        <Tabs
          value={tab}
          onChange={setTab}
          tabs={[
            { value: "jobs", label: "Jobs", count: savedJobs.length },
            { value: "searches", label: "Searches", count: 0 },
            { value: "companies", label: "Companies", count: 0 },
          ]}
        />
      </div>

      {tab === "jobs" && (
        <>
          {loading ? (
            <div className="space-y-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="rounded-[var(--radius-card)] border border-line bg-white p-5 animate-pulse">
                  <div className="flex gap-3.5">
                    <div className="size-11 rounded-[10px] bg-soft" />
                    <div className="grow space-y-2">
                      <div className="h-5 w-1/3 rounded bg-soft" />
                      <div className="h-4 w-1/2 rounded bg-soft" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
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
                <JobCard
                  key={job.slug}
                  job={job}
                  saved={true}
                  onSave={() => handleUnsave(job)}
                />
              ))}
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
