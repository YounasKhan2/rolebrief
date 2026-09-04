import { useEffect, useState } from "react";
import { NavLink, Outlet, ScrollRestoration, Link } from "react-router";
import {
  Radar,
  Search,
  Newspaper,
  ListChecks,
  Bookmark,
  Bell,
  Command,
  Settings,
} from "lucide-react";
import { Wordmark } from "../rolebrief/Wordmark";
import { classNames } from "../../lib/format";
import { CommandPalette } from "./CommandPalette";

const primaryNav = [
  { to: "/app/radar", label: "Radar", icon: Radar },
  { to: "/app/jobs", label: "Jobs", icon: Search },
  { to: "/news", label: "Market Pulse", icon: Newspaper },
  { to: "/app/tracker", label: "Tracker", icon: ListChecks },
  { to: "/app/saved", label: "Saved", icon: Bookmark },
];

const bottomNav = [
  { to: "/app/radar", label: "Radar", icon: Radar },
  { to: "/app/jobs", label: "Jobs", icon: Search },
  { to: "/news", label: "Pulse", icon: Newspaper },
  { to: "/app/tracker", label: "Tracker", icon: ListChecks },
  { to: "/app/saved", label: "Saved", icon: Bookmark },
];

export default function AppShell() {
  const [paletteOpen, setPaletteOpen] = useState(false);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((v) => !v);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="min-h-full bg-white text-ink flex flex-col">
      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
      {/* Desktop / tablet top nav */}
      <header className="sticky top-0 z-40 bg-white/90 backdrop-blur border-b border-line">
        <div className="mx-auto max-w-[1280px] px-4 sm:px-6 lg:px-8 h-16 flex items-center gap-6">
          <Link to="/app/radar" aria-label="RoleBrief home">
            <Wordmark size="sm" />
          </Link>
          <nav className="hidden md:flex items-center gap-1 grow">
            {primaryNav.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  classNames(
                    "inline-flex items-center gap-2 h-10 px-3 rounded-[var(--radius-control)] text-sm font-medium transition-colors",
                    isActive ? "bg-indigo-tint text-navy" : "text-slate hover:text-ink hover:bg-soft",
                  )
                }
              >
                <item.icon size={16} />
                {item.label}
              </NavLink>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-1">
            <button
              onClick={() => setPaletteOpen(true)}
              className="hidden sm:inline-flex items-center gap-2 h-10 px-3 rounded-[var(--radius-control)] border border-line text-[13px] text-slate hover:border-ink/30 transition-colors"
            >
              <Command size={14} /> Search or jump to
              <kbd className="font-data text-[11px] bg-soft rounded px-1">⌘K</kbd>
            </button>
            <button
              onClick={() => setPaletteOpen(true)}
              aria-label="Search"
              className="sm:hidden inline-flex items-center justify-center size-10 rounded-[var(--radius-control)] text-slate hover:bg-soft hover:text-ink"
            >
              <Search size={18} />
            </button>
            <NavLink to="/app/notifications" aria-label="Notifications" className="inline-flex items-center justify-center size-10 rounded-[var(--radius-control)] text-slate hover:bg-soft hover:text-ink relative">
              <Bell size={18} />
              <span className="absolute top-2 right-2 size-1.5 bg-indigo rounded-full" />
            </NavLink>
            <NavLink to="/app/settings" aria-label="Settings" className="hidden sm:inline-flex items-center justify-center size-10 rounded-[var(--radius-control)] text-slate hover:bg-soft hover:text-ink">
              <Settings size={18} />
            </NavLink>
            <NavLink to="/app/profile" aria-label="Profile" className="inline-flex items-center justify-center size-9 rounded-full bg-navy text-white text-[13px] font-semibold ml-1">
              AK
            </NavLink>
          </div>
        </div>
      </header>

      <main className="grow pb-24 md:pb-0">
        <Outlet />
      </main>

      {/* Mobile bottom nav (safe-area aware) */}
      <nav
        className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-white/95 backdrop-blur border-t border-line"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
        aria-label="Primary"
      >
        <div className="grid grid-cols-5">
          {bottomNav.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                classNames(
                  "flex flex-col items-center justify-center gap-1 h-16 text-[11px] font-medium relative",
                  isActive ? "text-indigo" : "text-slate",
                )
              }
            >
              {({ isActive }) => (
                <>
                  {isActive && <span className="absolute top-0 h-0.5 w-8 bg-indigo rounded-full" />}
                  <item.icon size={20} />
                  {item.label}
                </>
              )}
            </NavLink>
          ))}
        </div>
      </nav>

      <ScrollRestoration />
    </div>
  );
}

// Shared page container + header used across product screens.
export function PageContainer({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={classNames("mx-auto max-w-[1280px] px-4 sm:px-6 lg:px-8 py-6 sm:py-8", className)}>{children}</div>;
}

export function PageHeader({
  kicker,
  title,
  description,
  actions,
}: {
  kicker?: string;
  title: string;
  description?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
      <div>
        {kicker && <p className="kicker mb-2">{kicker}</p>}
        <h1 className="text-3xl font-semibold tracking-tight text-ink">{title}</h1>
        {description && <p className="text-slate mt-1.5 max-w-2xl">{description}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}
