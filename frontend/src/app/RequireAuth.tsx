import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router";
import { useAuth, SessionError } from "../lib/auth";
import { buildReturnToQuery } from "../lib/routing";

/**
 * Route guard: ensures user is authenticated before viewing protected product routes.
 * - status === "loading" → stable session check placeholder
 * - status === "error" → retryable SessionError
 * - unauthenticated → redirect to /login?returnTo=<encoded pathname+search+hash> with replace
 * - authenticated → render children
 */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { isAuthenticated, status, reload, error } = useAuth();
  const location = useLocation();

  if (status === "loading") {
    return (
      <div className="mx-auto max-w-md px-6 py-24 text-center text-slate">
        Checking your session...
      </div>
    );
  }

  if (status === "error") {
    return (
      <SessionError
        message={error?.message || "Could not verify session."}
        onRetry={reload}
      />
    );
  }

  if (!isAuthenticated) {
    const returnToQuery = buildReturnToQuery(location.pathname, location.search, location.hash);
    return (
      <Navigate
        to={`/login${returnToQuery}`}
        state={{ returnTo: location.pathname + location.search + location.hash }}
        replace
      />
    );
  }

  return <>{children}</>;
}
