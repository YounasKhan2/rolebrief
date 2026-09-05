import { createBrowserRouter } from "react-router";
import MarketingLayout from "../components/shell/MarketingLayout";
import AppShell from "../components/shell/AppShell";
import { RouteFallback } from "./RouteFallback";
import { RequireAuth } from "./RequireAuth";
import { RequireAdmin } from "./RequireAdmin";

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
      { path: "news", lazy: () => import("../screens/news/MarketPulseScreen") },
      { path: "news/:slug", lazy: () => import("../screens/news/NewsDetailScreen") },
      { path: "companies/:slug", lazy: () => import("../screens/companies/CompanyScreen") },

      // Info pages
      { path: "how-it-works", lazy: () => import("../screens/marketing/PlaceholderScreen") },
      { path: "coverage", lazy: () => import("../screens/marketing/PlaceholderScreen") },
      { path: "sources-methodology", lazy: () => import("../screens/methodology/MethodologyScreen") },
      { path: "about", lazy: () => import("../screens/marketing/PlaceholderScreen") },
      { path: "privacy", lazy: () => import("../screens/marketing/PlaceholderScreen") },
      { path: "terms", lazy: () => import("../screens/marketing/PlaceholderScreen") },

      // Authentication screens (public)
      { path: "login", lazy: () => import("../screens/auth/AuthScreen") },
      { path: "signup", lazy: () => import("../screens/auth/AuthScreen") },
      { path: "forgot-password", lazy: () => import("../screens/auth/AuthScreen") },
      { path: "reset-password", lazy: () => import("../screens/auth/AuthScreen") },
      { path: "verify-email", lazy: () => import("../screens/auth/AuthScreen") },
    ],
  },

  /* ------------------------------------------------------------------ */
  /*  GROUP 2 — AUTHENTICATED WORKSPACE (AppShell, requires login)      */
  /* ------------------------------------------------------------------ */
  {
    path: "/app",
    element: (
      <RequireAuth>
        <AppShell />
      </RequireAuth>
    ),
    HydrateFallback: RouteFallback,
    children: [
      { path: "onboarding", lazy: () => import("../screens/onboarding/OnboardingScreen") },
      { path: "radar", lazy: () => import("../screens/radar/RadarScreen") },
      { path: "jobs", lazy: () => import("../screens/jobs/JobsScreen") },
      { path: "jobs/:slug", lazy: () => import("../screens/jobs/JobDetailScreen") },
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
