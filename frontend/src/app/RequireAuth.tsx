import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router";
import { useAuth } from "../lib/auth";

/**
 * Route guard: redirects unauthenticated visitors to /login with a return-to
 * state so they land back here after signing in.
 */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { isAuthenticated, status } = useAuth();
  const location = useLocation();

  if (status === "loading") {
    return <div className="mx-auto max-w-md px-6 py-24 text-center text-slate">Checking your session...</div>;
  }

  if (!isAuthenticated) {
    return (
      <Navigate
        to="/login"
        state={{ returnTo: location.pathname + location.search }}
        replace
      />
    );
  }

  return <>{children}</>;
}
