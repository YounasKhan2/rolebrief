import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router";
import { useAuth } from "../lib/auth";

/**
 * Route guard: requires both authentication AND admin privileges.
 * - Not authenticated → redirect to /login with return-to state
 * - Authenticated but not admin → show Forbidden screen
 */
export function RequireAdmin({ children }: { children: ReactNode }) {
  const { isAuthenticated, isAdmin } = useAuth();
  const location = useLocation();

  if (!isAuthenticated) {
    return (
      <Navigate
        to="/login"
        state={{ returnTo: location.pathname + location.search }}
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
    <div className="mx-auto max-w-md px-6 py-24 text-center">
      <p className="kicker mb-3">Error 403</p>
      <h1 className="font-display text-4xl text-navy leading-tight">Access denied</h1>
      <p className="mt-4 text-slate">
        You don&apos;t have permission to view this page. If you believe this is
        an error, contact your administrator.
      </p>
    </div>
  );
}
