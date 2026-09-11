import type { ReactNode } from "react";
import { Navigate, useLocation, useSearchParams } from "react-router";
import { useAuth, SessionError } from "../lib/auth/auth";
import { sanitizeReturnTo } from "../lib/core/routing";

/**
 * Route guard for guest-only authentication routes (/login, /signup).
 * - status === "loading" → render stable session check placeholder
 * - status === "error" → render retryable SessionError
 * - unauthenticated → render children
 * - authenticated → redirect to safe returnTo (defaults to /admin for ADMIN, /app/radar for USER) with replace: true
 */
export function GuestOnly({ children }: { children?: ReactNode }) {
  const { isAuthenticated, status, user, reload, error } = useAuth();
  const location = useLocation();
  const [searchParams] = useSearchParams();

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

  if (isAuthenticated) {
    const returnToQuery = searchParams.get("returnTo");
    const returnToState = (location.state as { returnTo?: string } | null)?.returnTo;
    const target = sanitizeReturnTo(returnToQuery || returnToState, user?.role);
    return <Navigate to={target} replace />;
  }

  return <>{children}</>;
}
