import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { useAuth } from "./auth";
import { useToast } from "../components/ui/toast";
import { fetchSavedJobSlugs, saveJob as apiSaveJob, unsaveJob as apiUnsaveJob } from "./saved-api";

export interface SavedContextType {
  savedSlugs: Set<string>;
  isSaved: (slug: string) => boolean;
  toggleSave: (slug: string) => Promise<boolean>;
  save: (slug: string) => Promise<boolean>;
  unsave: (slug: string) => Promise<boolean>;
  savedCount: number;
  isLoading: boolean;
  refreshSaved: () => Promise<void>;
}

const SavedContext = createContext<SavedContextType>({
  savedSlugs: new Set(),
  isSaved: () => false,
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

export function SavedProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated, user } = useAuth();
  const toast = useToast();
  const [savedSlugs, setSavedSlugs] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(false);

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

  useEffect(() => {
    if (isAuthenticated) {
      void refreshSaved();
    } else {
      setSavedSlugs(new Set());
    }
  }, [isAuthenticated, user?.id, refreshSaved]);

  const isSaved = useCallback((slug: string) => savedSlugs.has(slug), [savedSlugs]);

  const save = useCallback(async (slug: string): Promise<boolean> => {
    // Optimistic update
    setSavedSlugs((prev) => {
      const next = new Set(prev);
      next.add(slug);
      return next;
    });

    try {
      await apiSaveJob(slug);
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
    }
  }, [toast]);

  const unsave = useCallback(async (slug: string): Promise<boolean> => {
    // Optimistic update
    setSavedSlugs((prev) => {
      const next = new Set(prev);
      next.delete(slug);
      return next;
    });

    try {
      await apiUnsaveJob(slug);
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
    }
  }, [toast]);

  const toggleSave = useCallback(async (slug: string): Promise<boolean> => {
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
      isSaved,
      toggleSave,
      save,
      unsave,
      savedCount: savedSlugs.size,
      isLoading,
      refreshSaved,
    }),
    [savedSlugs, isSaved, toggleSave, save, unsave, isLoading, refreshSaved]
  );

  return <SavedContext.Provider value={value}>{children}</SavedContext.Provider>;
}
