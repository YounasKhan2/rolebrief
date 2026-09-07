import { createBrowserRouter, Navigate, Outlet, useLocation, useParams } from "react-router";
import MarketingLayout from "../components/shell/MarketingLayout";
import AppShell from "../components/shell/AppShell";
import { RouteFallback } from "./RouteFallback";
import { RequireAuth } from "./RequireAuth";
import { RequireAdmin } from "./RequireAdmin";
import { GuestOnly } from "./GuestOnly";
import { OnboardingLayout } from "../layouts/OnboardingLayout";
import { OnboardingGate } from "../components/auth/OnboardingGate";

/** Helper component to redirect root-level aliases to canonical /app/* routes while preserving query params and hash. */
function AliasRedirect({ to }: { to: string }) {
  const location = useLocation();
  return <Navigate to={`${to}${location.search}${location.hash}`} replace />;
}

/** Helper component to redirect root-level news slug alias to /app/news/:slug while preserving query and hash. */
function NewsSlugAliasRedirect() {
  const { slug } = useParams();
  const location = useLocation();
  return <Navigate to={`/app/news/${slug ?? ""}${location.search}${location.hash}`} replace />;
}

// Layout wrappers stay eager; each leaf screen is lazy-loaded so the shell is
// not one oversized bundle. Every screen module exports `Component`.

export const router = createBrowserRouter([
  /* ------------------------------------------------------------------ */
  /*  GROUP 1 — PUBLIC (MarketingLayout, never requires authentication) */
  /* ------------------------------------------------------------------ */
  {
    path: "/",
    Component: MarketingLayout,
    HydrateFallback: RouteFallback,
    children: [
      // Landing
      { index: true, lazy: () => import("../screens/marketing/LandingScreen") },

      // Public content — viewable by everyone
      { path: "jobs", lazy: () => import("../screens/jobs/JobsScreen") },
      { path: "jobs/:slug", lazy: () => import("../screens/jobs/JobDetailScreen") },
      { path: "companies/:slug", lazy: () => import("../screens/companies/CompanyScreen") },

      // Info pages
      { path: "how-it-works", lazy: () => import("../screens/marketing/PlaceholderScreen") },
      { path: "coverage", lazy: () => import("../screens/marketing/PlaceholderScreen") },
      { path: "sources-methodology", lazy: () => import("../screens/methodology/MethodologyScreen") },
      { path: "about", lazy: () => import("../screens/marketing/PlaceholderScreen") },
      { path: "privacy", lazy: () => import("../screens/marketing/PlaceholderScreen") },
      { path: "terms", lazy: () => import("../screens/marketing/PlaceholderScreen") },

      // Guest-only authentication routes (redirect authenticated users away)
      {
        element: (
          <GuestOnly>
            <Outlet />
          </GuestOnly>
        ),
        children: [
          { path: "login", lazy: () => import("../screens/auth/AuthScreen") },
          { path: "signup", lazy: () => import("../screens/auth/AuthScreen") },
        ],
      },

      // Public token-action & recovery routes
      { path: "forgot-password", lazy: () => import("../screens/auth/AuthScreen") },
      { path: "reset-password", lazy: () => import("../screens/auth/AuthScreen") },
      { path: "verify-email", lazy: () => import("../screens/auth/AuthScreen") },

      // Root compatibility aliases (redirect to canonical /app/* preserving query & hash)
      { path: "radar", element: <AliasRedirect to="/app/radar" /> },
      { path: "news", element: <AliasRedirect to="/app/news" /> },
      { path: "news/:slug", element: <NewsSlugAliasRedirect /> },
      { path: "saved", element: <AliasRedirect to="/app/saved" /> },
      { path: "tracker", element: <AliasRedirect to="/app/tracker" /> },
      { path: "alerts", element: <AliasRedirect to="/app/alerts" /> },
      { path: "compare", element: <AliasRedirect to="/app/compare" /> },
      { path: "notifications", element: <AliasRedirect to="/app/notifications" /> },
      { path: "profile", element: <AliasRedirect to="/app/profile" /> },
      { path: "settings", element: <AliasRedirect to="/app/settings" /> },
      { path: "onboarding", element: <AliasRedirect to="/app/onboarding" /> },
    ],
  },

  /* ------------------------------------------------------------------ */
  /*  GROUP 2A — ONBOARDING (Dedicated minimal OnboardingLayout)         */
  /* ------------------------------------------------------------------ */
  {
    path: "/app/onboarding",
    element: (
      <RequireAuth>
        <OnboardingGate>
          <OnboardingLayout />
        </OnboardingGate>
      </RequireAuth>
    ),
    HydrateFallback: RouteFallback,
    children: [
      { index: true, lazy: () => import("../screens/onboarding/OnboardingScreen") },
    ],
  },

  /* ------------------------------------------------------------------ */
  /*  GROUP 2B — AUTHENTICATED WORKSPACE (AppShell, requires login)     */
  /* ------------------------------------------------------------------ */
  {
    path: "/app",
    element: (
      <RequireAuth>
        <OnboardingGate>
          <AppShell />
        </OnboardingGate>
      </RequireAuth>
    ),
    HydrateFallback: RouteFallback,
    children: [
      { index: true, element: <Navigate to="/app/radar" replace /> },
      { path: "radar", lazy: () => import("../screens/radar/RadarScreen") },
      { path: "jobs", lazy: () => import("../screens/jobs/JobsScreen") },
      { path: "jobs/:slug", lazy: () => import("../screens/jobs/JobDetailScreen") },
      { path: "news", lazy: () => import("../screens/news/MarketPulseScreen") },
      { path: "news/:slug", lazy: () => import("../screens/news/NewsDetailScreen") },
      { path: "saved", lazy: () => import("../screens/saved/SavedScreen") },
      { path: "compare", lazy: () => import("../screens/compare/CompareScreen") },
      { path: "alerts", lazy: () => import("../screens/alerts/AlertsScreen") },
      { path: "tracker", lazy: () => import("../screens/tracker/TrackerScreen") },
      { path: "notifications", lazy: () => import("../screens/notifications/NotificationsScreen") },
      { path: "profile", lazy: () => import("../screens/profile/ProfileScreen") },
      { path: "settings", lazy: () => import("../screens/settings/SettingsScreen") },
      { path: "settings/notifications", lazy: () => import("../screens/settings/SettingsScreen") },
    ],
  },

  /* ------------------------------------------------------------------ */
  /*  GROUP 3 — ADMIN (AppShell, requires login + admin role)           */
  /* ------------------------------------------------------------------ */
  {
    path: "/admin",
    element: (
      <RequireAdmin>
        <AppShell />
      </RequireAdmin>
    ),
    HydrateFallback: RouteFallback,
    children: [
      { index: true, lazy: () => import("../screens/admin/AdminScreen") },
      { path: "sources", lazy: () => import("../screens/admin/AdminSourcesScreen") },
      { path: "moderation", lazy: () => import("../screens/admin/AdminModerationScreen") },
    ],
  },

  /* ------------------------------------------------------------------ */
  /*  CATCH-ALL 404                                                     */
  /* ------------------------------------------------------------------ */
  { path: "*", lazy: () => import("../screens/NotFoundScreen") },
]);
