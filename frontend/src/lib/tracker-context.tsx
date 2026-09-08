import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState
} from "react";
import type { ReactNode } from "react";
import { useAuth } from "./auth";
import { useToast } from "../components/ui/toast";
import {
  ApplicationStage,
  CreateApplicationPayload,
  TrackedApplication,
  UpdateApplicationPayload,
  archiveApplication as apiArchiveApplication,
  createApplication as apiCreateApplication,
  deleteApplication as apiDeleteApplication,
  fetchApplications as apiFetchApplications,
  restoreApplication as apiRestoreApplication,
  updateApplication as apiUpdateApplication
} from "./tracker-api";

export interface TrackerContextType {
  trackedJobSlugs: Set<string>;
  isTracked: (slug: string) => boolean;
  isPending: (key: string) => boolean;
  stageCounts: Record<ApplicationStage, number>;
  trackJob: (slug: string) => Promise<TrackedApplication | null>;
  addManualApplication: (payload: CreateApplicationPayload) => Promise<TrackedApplication | null>;
  updateStage: (
    id: string,
    stage: ApplicationStage,
    expectedRevision: number,
    note?: string
  ) => Promise<TrackedApplication | null>;
  updateApplication: (
    id: string,
    payload: UpdateApplicationPayload
  ) => Promise<TrackedApplication | null>;
  archiveApplication: (id: string, expectedRevision: number) => Promise<TrackedApplication | null>;
  restoreApplication: (id: string, expectedRevision: number) => Promise<TrackedApplication | null>;
  deleteApplication: (id: string, expectedRevision: number) => Promise<boolean>;
  refreshTracker: () => Promise<void>;
  isLoading: boolean;
}

const DEFAULT_STAGE_COUNTS: Record<ApplicationStage, number> = {
  SAVED: 0,
  APPLIED: 0,
  INTERVIEWING: 0,
  OFFER: 0,
  REJECTED: 0,
  WITHDRAWN: 0
};

const TrackerContext = createContext<TrackerContextType>({
  trackedJobSlugs: new Set(),
  isTracked: () => false,
  isPending: () => false,
  stageCounts: DEFAULT_STAGE_COUNTS,
  trackJob: async () => null,
  addManualApplication: async () => null,
  updateStage: async () => null,
  updateApplication: async () => null,
  archiveApplication: async () => null,
  restoreApplication: async () => null,
  deleteApplication: async () => false,
  refreshTracker: async () => {},
  isLoading: false
});

export function useTracker() {
  return useContext(TrackerContext);
}

const BROADCAST_CHANNEL_NAME = "rolebrief_tracker";

export function TrackerProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated, user } = useAuth();
  const toast = useToast();

  const [trackedJobSlugs, setTrackedJobSlugs] = useState<Set<string>>(new Set());
  const [stageCounts, setStageCounts] = useState<Record<ApplicationStage, number>>(DEFAULT_STAGE_COUNTS);
  const [pendingKeys, setPendingKeys] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(false);

  const pendingKeysRef = useRef<Set<string>>(new Set());
  const channelRef = useRef<BroadcastChannel | null>(null);

  const refreshTracker = useCallback(async () => {
    if (!isAuthenticated) {
      setTrackedJobSlugs(new Set());
      setStageCounts(DEFAULT_STAGE_COUNTS);
      return;
    }

    try {
      setIsLoading(true);
      const res = await apiFetchApplications({ limit: 50 });
      if (res) {
        setStageCounts(res.stageCounts || DEFAULT_STAGE_COUNTS);
        const slugs = new Set<string>();
        for (const app of res.data) {
          if (app.jobSlug) slugs.add(app.jobSlug);
        }
        setTrackedJobSlugs(slugs);
      }
    } catch {
      // background error handled quietly
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated]);

  // Auth sync
  useEffect(() => {
    if (isAuthenticated) {
      void refreshTracker();
    } else {
      setTrackedJobSlugs(new Set());
      setStageCounts(DEFAULT_STAGE_COUNTS);
      pendingKeysRef.current.clear();
      setPendingKeys(new Set());
    }
  }, [isAuthenticated, user?.id, refreshTracker]);

  // Cross-tab broadcast & focus revalidation
  useEffect(() => {
    if (typeof window === "undefined" || typeof BroadcastChannel === "undefined") {
      return;
    }

    const channel = new BroadcastChannel(BROADCAST_CHANNEL_NAME);
    channelRef.current = channel;

    channel.onmessage = (event) => {
      const msg = event.data;
      if (!msg || typeof msg !== "object") return;
      if (msg.type === "tracked" && typeof msg.slug === "string") {
        setTrackedJobSlugs((prev) => new Set(prev).add(msg.slug));
        void refreshTracker();
      } else if (msg.type === "updated" || msg.type === "sync") {
        void refreshTracker();
      }
    };

    const handleFocus = () => {
      if (isAuthenticated) {
        void refreshTracker();
      }
    };
    window.addEventListener("focus", handleFocus);

    return () => {
      channel.close();
      channelRef.current = null;
      window.removeEventListener("focus", handleFocus);
    };
  }, [isAuthenticated, refreshTracker]);

  const isTracked = useCallback(
    (slug: string) => trackedJobSlugs.has(slug),
    [trackedJobSlugs]
  );

  const isPending = useCallback(
    (key: string) => pendingKeys.has(key),
    [pendingKeys]
  );

  const trackJob = useCallback(
    async (slug: string): Promise<TrackedApplication | null> => {
      if (pendingKeysRef.current.has(slug)) return null;

      pendingKeysRef.current.add(slug);
      setPendingKeys(new Set(pendingKeysRef.current));

      try {
        const app = await apiCreateApplication({ jobSlug: slug, stage: "SAVED" });
        setTrackedJobSlugs((prev) => new Set(prev).add(slug));
        channelRef.current?.postMessage({ type: "tracked", slug });
        if (app.alreadyTracked) {
          toast({
            kind: "info",
            message: `"${app.roleTitle}" is already in your application tracker.`
          });
        } else if ((app as any).restored) {
          toast({
            kind: "success",
            message: `Restored "${app.roleTitle}" from archive to your application tracker.`
          });
        } else {
          toast({
            kind: "success",
            message: `Added "${app.roleTitle}" to your application tracker.`
          });
        }
        void refreshTracker();
        return app;
      } catch (err: any) {
        toast({
          kind: "error",
          message: err?.message || "Could not track job. Please try again."
        });
        return null;
      } finally {
        pendingKeysRef.current.delete(slug);
        setPendingKeys(new Set(pendingKeysRef.current));
      }
    },
    [toast, refreshTracker]
  );

  const addManualApplication = useCallback(
    async (payload: CreateApplicationPayload): Promise<TrackedApplication | null> => {
      const key = `manual_${Date.now()}`;
      pendingKeysRef.current.add(key);
      setPendingKeys(new Set(pendingKeysRef.current));

      try {
        const app = await apiCreateApplication(payload);
        channelRef.current?.postMessage({ type: "updated" });
        toast({
          kind: "success",
          message: `Created application for "${app.roleTitle}".`
        });
        void refreshTracker();
        return app;
      } catch (err: any) {
        toast({
          kind: "error",
          message: err?.message || "Failed to create application."
        });
        return null;
      } finally {
        pendingKeysRef.current.delete(key);
        setPendingKeys(new Set(pendingKeysRef.current));
      }
    },
    [toast, refreshTracker]
  );

  const updateStage = useCallback(
    async (
      id: string,
      stage: ApplicationStage,
      expectedRevision: number,
      note?: string
    ): Promise<TrackedApplication | null> => {
      if (pendingKeysRef.current.has(id)) return null;

      pendingKeysRef.current.add(id);
      setPendingKeys(new Set(pendingKeysRef.current));

      try {
        const updated = await apiUpdateApplication(id, {
          stage,
          expectedRevision,
          stageChangeNote: note
        });
        channelRef.current?.postMessage({ type: "updated" });
        void refreshTracker();
        return updated;
      } catch (err: any) {
        if (err?.status === 409) {
          toast({
            kind: "warning",
            message: "The application was modified elsewhere. Refreshed latest data."
          });
          void refreshTracker();
        } else {
          toast({
            kind: "error",
            message: err?.message || "Failed to update application stage."
          });
        }
        return null;
      } finally {
        pendingKeysRef.current.delete(id);
        setPendingKeys(new Set(pendingKeysRef.current));
      }
    },
    [toast, refreshTracker]
  );

  const updateApplication = useCallback(
    async (id: string, payload: UpdateApplicationPayload): Promise<TrackedApplication | null> => {
      if (pendingKeysRef.current.has(id)) return null;

      pendingKeysRef.current.add(id);
      setPendingKeys(new Set(pendingKeysRef.current));

      try {
        const updated = await apiUpdateApplication(id, payload);
        channelRef.current?.postMessage({ type: "updated" });
        toast({
          kind: "success",
          message: "Application updated successfully."
        });
        void refreshTracker();
        return updated;
      } catch (err: any) {
        if (err?.status === 409) {
          toast({
            kind: "warning",
            message: "Conflict: another action modified this application. Reloading latest state."
          });
          void refreshTracker();
        } else {
          toast({
            kind: "error",
            message: err?.message || "Failed to update application."
          });
        }
        return null;
      } finally {
        pendingKeysRef.current.delete(id);
        setPendingKeys(new Set(pendingKeysRef.current));
      }
    },
    [toast, refreshTracker]
  );

  const archiveApplication = useCallback(
    async (id: string, expectedRevision: number): Promise<TrackedApplication | null> => {
      if (pendingKeysRef.current.has(id)) return null;

      pendingKeysRef.current.add(id);
      setPendingKeys(new Set(pendingKeysRef.current));

      try {
        const archived = await apiArchiveApplication(id, expectedRevision);
        channelRef.current?.postMessage({ type: "updated" });
        toast({
          kind: "success",
          message: `Archived application for "${archived.roleTitle}".`
        });
        void refreshTracker();
        return archived;
      } catch (err: any) {
        if (err?.status === 409) {
          toast({
            kind: "warning",
            message: "Conflict: this application was modified elsewhere. Reloading..."
          });
          void refreshTracker();
        } else {
          toast({
            kind: "error",
            message: err?.message || "Failed to archive application."
          });
        }
        return null;
      } finally {
        pendingKeysRef.current.delete(id);
        setPendingKeys(new Set(pendingKeysRef.current));
      }
    },
    [toast, refreshTracker]
  );

  const restoreApplication = useCallback(
    async (id: string, expectedRevision: number): Promise<TrackedApplication | null> => {
      if (pendingKeysRef.current.has(id)) return null;

      pendingKeysRef.current.add(id);
      setPendingKeys(new Set(pendingKeysRef.current));

      try {
        const restored = await apiRestoreApplication(id, expectedRevision);
        channelRef.current?.postMessage({ type: "updated" });
        toast({
          kind: "success",
          message: `Restored application for "${restored.roleTitle}".`
        });
        void refreshTracker();
        return restored;
      } catch (err: any) {
        if (err?.status === 409) {
          toast({
            kind: "warning",
            message: "Conflict: this application was modified elsewhere. Reloading..."
          });
          void refreshTracker();
        } else {
          toast({
            kind: "error",
            message: err?.message || "Failed to restore application."
          });
        }
        return null;
      } finally {
        pendingKeysRef.current.delete(id);
        setPendingKeys(new Set(pendingKeysRef.current));
      }
    },
    [toast, refreshTracker]
  );

  const deleteApplication = useCallback(
    async (id: string, expectedRevision: number): Promise<boolean> => {
      if (pendingKeysRef.current.has(id)) return false;

      pendingKeysRef.current.add(id);
      setPendingKeys(new Set(pendingKeysRef.current));

      try {
        await apiDeleteApplication(id, expectedRevision);
        channelRef.current?.postMessage({ type: "updated" });
        toast({
          kind: "success",
          message: "Application removed from tracker."
        });
        void refreshTracker();
        return true;
      } catch (err: any) {
        if (err?.status === 409) {
          toast({
            kind: "warning",
            message: "Conflict: this application was modified elsewhere. Reloading..."
          });
          void refreshTracker();
        } else {
          toast({
            kind: "error",
            message: err?.message || "Failed to remove application."
          });
        }
        return false;
      } finally {
        pendingKeysRef.current.delete(id);
        setPendingKeys(new Set(pendingKeysRef.current));
      }
    },
    [toast, refreshTracker]
  );

  const value = useMemo(
    () => ({
      trackedJobSlugs,
      isTracked,
      isPending,
      stageCounts,
      trackJob,
      addManualApplication,
      updateStage,
      updateApplication,
      archiveApplication,
      restoreApplication,
      deleteApplication,
      refreshTracker,
      isLoading
    }),
    [
      trackedJobSlugs,
      isTracked,
      isPending,
      stageCounts,
      trackJob,
      addManualApplication,
      updateStage,
      updateApplication,
      archiveApplication,
      restoreApplication,
      deleteApplication,
      refreshTracker,
      isLoading
    ]
  );

  return <TrackerContext.Provider value={value}>{children}</TrackerContext.Provider>;
}
