import { useEffect } from "react";
import { Outlet, Link, NavLink, ScrollRestoration, useLocation } from "react-router";
import { Wordmark } from "../rolebrief/Wordmark";
import { LinkButton } from "../ui/primitives";
import { useAuth } from "../../lib/auth";
import { UserMenu } from "./AppShell";

const links = [
  { to: "/#radar", label: "Radar" },
  { to: "/#signals", label: "Signals" },
  { to: "/#coverage", label: "Coverage" },
  { to: "/jobs", label: "Jobs" },
];

/** Router-aware hash scrolling honoring prefers-reduced-motion and sticky header offset. */
export function useHashScroll() {
  const { hash, pathname } = useLocation();

  useEffect(() => {
    if (!hash) return;
    const targetId = hash.replace(/^#/, "");
    if (!targetId) return;

    let attempts = 0;
    const maxAttempts = 25;

    function attemptScroll() {
      const element = document.getElementById(targetId);
      if (element) {
        const prefersReducedMotion = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
        element.scrollIntoView({
          behavior: prefersReducedMotion ? "instant" : "smooth",
          block: "start",
        });
      } else if (attempts < maxAttempts) {
        attempts++;
        requestAnimationFrame(attemptScroll);
      }
    }

    const timer = setTimeout(attemptScroll, 60);
    return () => clearTimeout(timer);
  }, [hash, pathname]);
}

export default function MarketingLayout() {
  useHashScroll();
  const { pathname } = useLocation();
  const { user, isAuthenticated, isAdmin, status } = useAuth();

  if (pathname === "/") return <><Outlet /><ScrollRestoration /></>;

  return (
    <div className="min-h-full paper-grain text-ink flex flex-col">
      <header className="sticky top-0 z-40 bg-paper/85 backdrop-blur border-b border-line/70">
        <div className="mx-auto max-w-[1248px] px-5 sm:px-8 h-16 flex items-center gap-6">
          <Link to="/" aria-label="RoleBrief home">
            <Wordmark />
          </Link>
          <nav className="hidden md:flex items-center gap-1 ml-4">
            {links.map((l) => (
              <Link
                key={l.label}
                to={l.to}
                className="px-3 h-9 inline-flex items-center text-sm text-slate hover:text-ink rounded-[var(--radius-control)] hover:bg-ink/5 transition-colors"
              >
                {l.label}
              </Link>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-2">
            {status === "loading" ? (
              <div className="h-9 w-24 rounded-[var(--radius-control)] bg-ink/5 animate-pulse" />
            ) : isAuthenticated ? (
              <>
                {isAdmin ? (
                  <>
                    <LinkButton to="/admin" size="md">
                      Admin Console
                    </LinkButton>
                    <Link
                      to="/app/radar"
                      className="hidden sm:inline-flex items-center h-10 px-3 text-sm font-medium text-slate hover:text-ink hover:bg-ink/5 rounded-[var(--radius-control)]"
                    >
                      Radar
                    </Link>
                  </>
                ) : (
                  <LinkButton to="/app/radar" size="md">
                    Open Radar
                  </LinkButton>
                )}
                <UserMenu />
              </>
            ) : (
              <>
                <NavLink to="/login" className="hidden sm:inline-flex items-center h-10 px-3 text-sm font-medium text-ink hover:bg-ink/5 rounded-[var(--radius-control)]">
                  Log in
                </NavLink>
                <LinkButton to="/signup" size="md">
                  Get started
                </LinkButton>
              </>
            )}
          </div>
        </div>
      </header>

      <main className="grow">
        <Outlet />
      </main>

      <Footer />
      <ScrollRestoration />
    </div>
  );
}

function Footer() {
  const cols: { title: string; items: { label: string; to: string }[] }[] = [
    {
      title: "Product",
      items: [
        { label: "Overview", to: "/#signals" },
        { label: "Jobs", to: "/jobs" },
        { label: "Market Pulse", to: "/app/news" },
        { label: "Coverage", to: "/#coverage" },
      ],
    },
    {
      title: "Signature",
      items: [
        { label: "Eligibility Shield", to: "/#signals" },
        { label: "Match Brief", to: "/#signals" },
        { label: "Freshness Timeline", to: "/#signals" },
        { label: "Company Momentum", to: "/#signals" },
      ],
    },
    {
      title: "Company",
      items: [
        { label: "About", to: "/about" },
        { label: "Sources & methodology", to: "/sources-methodology" },
        { label: "Privacy", to: "/privacy" },
        { label: "Terms", to: "/terms" },
      ],
    },
  ];
  return (
    <footer className="border-t border-line/70 bg-paper">
      <div className="mx-auto max-w-[1248px] px-5 sm:px-8 py-14">
        <div className="grid gap-10 md:grid-cols-[1.5fr_1fr_1fr_1fr]">
          <div>
            <Wordmark />
            <p className="text-slate text-sm mt-3 max-w-xs">
              Your daily brief for better opportunities. Fresh technology roles, understandable fit and practical next actions.
            </p>
          </div>
          {cols.map((c) => (
            <div key={c.title}>
              <p className="kicker mb-3">{c.title}</p>
              <ul className="space-y-2">
                {c.items.map((i) => (
                  <li key={i.label}>
                    <Link to={i.to} className="text-sm text-slate hover:text-ink transition-colors">
                      {i.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className={("mt-12 pt-6 border-t border-line/70 flex flex-wrap items-center justify-between gap-3 text-[13px] text-slate")}>
          <span>© 2026 RoleBrief. Coverage: Pakistan · UAE · worldwide remote.</span>
          <span className="font-data">Every listing is source-linked and freshness-stamped.</span>
        </div>
      </div>
    </footer>
  );
}
