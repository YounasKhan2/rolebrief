import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { useAuth } from "./auth";
import { useToast } from "../components/ui/toast";
import { fetchSavedJobSlugs, saveJob as apiSaveJob, unsaveJob as apiUnsaveJob } from "./saved-api";

export interface SavedContextType {
  savedSlugs: Set<string>;
  pendingSlugs: Set<string>;
  isSaved: (slug: string) => boolean;
  isPending: (slug: string) => boolean;
  toggleSave: (slug: string) => Promise<boolean>;
  save: (slug: string) => Promise<boolean>;
  unsave: (slug: string) => Promise<boolean>;
  savedCount: number;
  isLoading: boolean;
  refreshSaved: () => Promise<void>;
}

const SavedContext = createContext<SavedContextType>({
  savedSlugs: new Set(),
  pendingSlugs: new Set(),
  isSaved: () => false,
  isPending: () => false,
  toggleSave: async () => false,
  save: async () => false,
  unsave: async () => false,
  savedCount: 0,
  isLoading: false,
  refreshSaved: async () => {},
});

export function useSaved() {
  return useContext(SavedContext);
}

const BROADCAST_CHANNEL_NAME = "rolebrief_saved";
export const SAVED_INTENT_KEY = "rb_intent_save_slug";

export function SavedProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated, user } = useAuth();
  const toast = useToast();
  const [savedSlugs, setSavedSlugs] = useState<Set<string>>(new Set());
  const [pendingSlugs, setPendingSlugs] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(false);

  // Keep a ref to pendingSlugs to avoid stale closure checks in rapid clicks
  const pendingSlugsRef = useRef<Set<string>>(new Set());
  const savedSlugsRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    savedSlugsRef.current = savedSlugs;
  }, [savedSlugs]);

  const channelRef = useRef<BroadcastChannel | null>(null);

  const refreshSaved = useCallback(async () => {
    if (!isAuthenticated) {
      setSavedSlugs(new Set());
      return;
    }
    try {
      setIsLoading(true);
      const slugs = await fetchSavedJobSlugs();
      setSavedSlugs(new Set(slugs));
    } catch {
      // Background sync errors don't trigger intrusive toasts
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated]);

  // Initial load and auth transitions
  useEffect(() => {
    if (isAuthenticated) {
      void refreshSaved();
    } else {
      setSavedSlugs(new Set());
      setPendingSlugs(new Set());
      pendingSlugsRef.current.clear();
    }
  }, [isAuthenticated, user?.id, refreshSaved]);

  // Cross-tab synchronization via BroadcastChannel & focus revalidation
  useEffect(() => {
    if (typeof window === "undefined" || typeof BroadcastChannel === "undefined") {
      return;
    }

    const channel = new BroadcastChannel(BROADCAST_CHANNEL_NAME);
    channelRef.current = channel;

    channel.onmessage = (event) => {
      const msg = event.data;
      if (!msg || typeof msg !== "object") return;

      if (msg.type === "saved" && typeof msg.slug === "string") {
        setSavedSlugs((prev) => {
          const next = new Set(prev);
          next.add(msg.slug);
          return next;
        });
      } else if (msg.type === "unsaved" && typeof msg.slug === "string") {
        setSavedSlugs((prev) => {
          const next = new Set(prev);
          next.delete(msg.slug);
          return next;
        });
      } else if (msg.type === "sync") {
        void refreshSaved();
      }
    };

    const handleFocus = () => {
      if (isAuthenticated) {
        void refreshSaved();
      }
    };
    window.addEventListener("focus", handleFocus);

    return () => {
      channel.close();
      channelRef.current = null;
      window.removeEventListener("focus", handleFocus);
    };
  }, [isAuthenticated, refreshSaved]);

  // Guest Intent Resumption
  useEffect(() => {
    if (!isAuthenticated || typeof window === "undefined") return;

    try {
      const intentSlug = sessionStorage.getItem(SAVED_INTENT_KEY);
      if (intentSlug) {
        sessionStorage.removeItem(SAVED_INTENT_KEY);
        void (async () => {
          setSavedSlugs((prev) => {
            const next = new Set(prev);
            next.add(intentSlug);
            return next;
          });
          try {
            await apiSaveJob(intentSlug);
            channelRef.current?.postMessage({ type: "saved", slug: intentSlug });
            toast({
              kind: "success",
              message: "Saved role from your previous session."
            });
          } catch {
            setSavedSlugs((prev) => {
              const next = new Set(prev);
              next.delete(intentSlug);
              return next;
            });
          }
        })();
      }
    } catch {
      // Storage unavailable or disabled
    }
  }, [isAuthenticated, toast]);

  const isSaved = useCallback((slug: string) => savedSlugs.has(slug), [savedSlugs]);
  const isPending = useCallback((slug: string) => pendingSlugs.has(slug), [pendingSlugs]);

  const save = useCallback(async (slug: string): Promise<boolean> => {
    // Rapid toggling / mutation lock
    if (pendingSlugsRef.current.has(slug)) {
      return savedSlugsRef.current.has(slug);
    }

    pendingSlugsRef.current.add(slug);
    setPendingSlugs(new Set(pendingSlugsRef.current));

    // Optimistic update
    setSavedSlugs((prev) => {
      const next = new Set(prev);
      next.add(slug);
      return next;
    });

    try {
      await apiSaveJob(slug);
      channelRef.current?.postMessage({ type: "saved", slug });
      return true;
    } catch (err: any) {
      // Rollback
      setSavedSlugs((prev) => {
        const next = new Set(prev);
        next.delete(slug);
        return next;
      });
      toast({ kind: "error", message: err?.message || "Could not save role. Please try again." });
      return false;
    } finally {
      pendingSlugsRef.current.delete(slug);
      setPendingSlugs(new Set(pendingSlugsRef.current));
    }
  }, [toast]);

  const unsave = useCallback(async (slug: string): Promise<boolean> => {
    // Rapid toggling / mutation lock
    if (pendingSlugsRef.current.has(slug)) {
      return savedSlugsRef.current.has(slug);
    }

    pendingSlugsRef.current.add(slug);
    setPendingSlugs(new Set(pendingSlugsRef.current));

    // Optimistic update
    setSavedSlugs((prev) => {
      const next = new Set(prev);
      next.delete(slug);
      return next;
    });

    try {
      await apiUnsaveJob(slug);
      channelRef.current?.postMessage({ type: "unsaved", slug });
      return true;
    } catch (err: any) {
      // Rollback
      setSavedSlugs((prev) => {
        const next = new Set(prev);
        next.add(slug);
        return next;
      });
      toast({ kind: "error", message: err?.message || "Could not remove saved role. Please try again." });
      return false;
    } finally {
      pendingSlugsRef.current.delete(slug);
      setPendingSlugs(new Set(pendingSlugsRef.current));
    }
  }, [toast]);

  const toggleSave = useCallback(async (slug: string): Promise<boolean> => {
    if (pendingSlugsRef.current.has(slug)) {
      return savedSlugsRef.current.has(slug);
    }
    const currentlySaved = savedSlugs.has(slug);
    if (currentlySaved) {
      return unsave(slug);
    } else {
      return save(slug);
    }
  }, [savedSlugs, save, unsave]);

  const value = useMemo(
    () => ({
      savedSlugs,
      pendingSlugs,
      isSaved,
      isPending,
      toggleSave,
      save,
      unsave,
      savedCount: savedSlugs.size,
      isLoading,
      refreshSaved,
    }),
    [savedSlugs, pendingSlugs, isSaved, isPending, toggleSave, save, unsave, isLoading, refreshSaved]
  );

  return <SavedContext.Provider value={value}>{children}</SavedContext.Provider>;
}
