import type { ReactNode } from "react";
import { Navigate, useLocation, Link } from "react-router";
import { useAuth, SessionError } from "../lib/auth";
import { buildReturnToQuery } from "../lib/routing";
import { Button } from "../components/ui/primitives";
import { ShieldAlert, ArrowLeft } from "lucide-react";

/**
 * Route guard: requires authenticated user with ADMIN role.
 * - status === "loading" → stable session check placeholder
 * - status === "error" → retryable SessionError
 * - unauthenticated → redirect to /login with encoded returnTo query
 * - authenticated but not admin → render 403 Forbidden with safe escape to /app/radar
 * - authenticated admin → render children
 */
export function RequireAdmin({ children }: { children: ReactNode }) {
  const { isAuthenticated, isAdmin, status, reload, error } = useAuth();
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

  if (!isAdmin) {
    return <Forbidden />;
  }

  return <>{children}</>;
}

function Forbidden() {
  return (
    <div
      role="alert"
      aria-live="assertive"
      className="mx-auto max-w-md px-6 py-24 text-center"
    >
      <div className="inline-flex items-center justify-center size-12 rounded-full bg-red-50 text-red-600 mb-4">
        <ShieldAlert size={24} />
      </div>
      <p className="kicker mb-2">Error 403</p>
      <h1 className="font-display text-3xl text-navy leading-tight">Access denied</h1>
      <p className="mt-3 text-sm text-slate leading-relaxed">
        You don&apos;t have administrative permissions to view operations and moderation consoles.
      </p>
      <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
        <Link
          to="/app/radar"
          className="inline-flex items-center gap-2 h-10 px-4 rounded-[var(--radius-control)] bg-indigo text-white text-sm font-medium hover:bg-indigo/90 transition-colors"
        >
          <ArrowLeft size={16} /> Return to Radar
        </Link>
        <Link
          to="/jobs"
          className="inline-flex items-center gap-2 h-10 px-4 rounded-[var(--radius-control)] border border-line text-ink text-sm font-medium hover:border-ink/30 transition-colors"
        >
          Browse jobs
        </Link>
      </div>
    </div>
  );
}
