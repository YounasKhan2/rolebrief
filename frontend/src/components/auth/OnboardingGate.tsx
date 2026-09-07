import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router";
import { Loader2, RefreshCw } from "lucide-react";
import { useAuth } from "../../lib/auth";
import { getOnboardingState, OnboardingState } from "../../lib/onboarding-api";
import { buildReturnToQuery } from "../../lib/routing";
import { Button } from "../ui/primitives";

interface OnboardingContextValue {
  state: OnboardingState | null;
  loading: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
  updateStateLocally: (newState: OnboardingState) => void;
}

const OnboardingContext = createContext<OnboardingContextValue>({
  state: null,
  loading: true,
  error: null,
  refresh: async () => {},
  updateStateLocally: () => {}
});

export function useOnboarding() {
  return useContext(OnboardingContext);
}

export function OnboardingGate({ children }: { children: React.ReactNode }) {
  const { user, isAdmin, isAuthenticated, status: authStatus } = useAuth();
  const location = useLocation();
  const [state, setState] = useState<OnboardingState | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchState = useCallback(async () => {
    if (!isAuthenticated || isAdmin) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const data = await getOnboardingState();
      setState(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err : new Error("Could not load onboarding status."));
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, isAdmin]);

  useEffect(() => {
    if (isAuthenticated && !isAdmin) {
      void fetchState();
    }
  }, [isAuthenticated, isAdmin, fetchState]);

  const updateStateLocally = useCallback((newState: OnboardingState) => {
    setState(newState);
  }, []);

  // 1. Admin bypass: Admins bypass onboarding completely
  if (isAdmin) {
    return <>{children}</>;
  }

  // If still loading auth, show minimal editorial loader
  if (authStatus === "loading") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-paper paper-grain text-ink">
        <div className="flex flex-col items-center gap-3">
          <Loader2 size={24} className="animate-spin text-indigo" />
          <span className="text-xs font-mono uppercase tracking-widest text-slate">
            Checking workspace…
          </span>
        </div>
      </div>
    );
  }

  // Check onboardingStatus from user (if present) or state
  const status = user?.onboardingStatus ?? state?.progress?.status;

  // 2. Focused gate: NOT_STARTED or IN_PROGRESS must complete or skip onboarding
  if (status === "NOT_STARTED" || status === "IN_PROGRESS") {
    const returnParam = location.pathname !== "/app" && location.pathname !== "/app/" && location.pathname !== "/app/radar"
      ? buildReturnToQuery(location.pathname, location.search, location.hash)
      : "";
    return <Navigate to={`/app/onboarding${returnParam}`} replace />;
  }

  // If status is not yet known and we are loading state
  if (status === undefined && loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-paper paper-grain text-ink">
        <div className="flex flex-col items-center gap-3">
          <Loader2 size={24} className="animate-spin text-indigo" />
          <span className="text-xs font-mono uppercase tracking-widest text-slate">
            Checking workspace…
          </span>
        </div>
      </div>
    );
  }

  // If error occurred fetching state and we don't know the status
  if (error && !state && status === undefined) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-paper paper-grain p-6 text-center">
        <div className="max-w-md w-full rounded-[var(--radius-card)] border border-line bg-white p-8 shadow-sm">
          <h2 className="text-lg font-semibold text-ink">Could not load workspace</h2>
          <p className="mt-2 text-sm text-slate">
            {error.message || "We encountered an issue checking your candidate profile status."}
          </p>
          <div className="mt-6 flex justify-center">
            <Button
              onClick={() => void fetchState()}
              variant="secondary"
              icon={<RefreshCw size={14} />}
            >
              Retry
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <OnboardingContext.Provider value={{ state, loading, error, refresh: fetchState, updateStateLocally }}>
      {children}
    </OnboardingContext.Provider>
  );
}
