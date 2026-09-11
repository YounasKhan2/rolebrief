import { useEffect, useRef, useState } from "react";
import { NavLink, Outlet, ScrollRestoration, Link, useNavigate } from "react-router";
import {
  Radar,
  Search,
  Newspaper,
  ListChecks,
  Bookmark,
  Bell,
  Command,
  Settings,
  Shield,
  User,
  LogOut,
  Loader2,
  ChevronDown,
} from "lucide-react";
import { Wordmark } from "../rolebrief/Wordmark";
import { classNames } from "../../lib/core/format";
import { CommandPalette } from "./CommandPalette";
import { useAuth } from "../../lib/auth/auth";
import { useToast } from "../../ui/toast";
import { getUnreadCount } from "../../lib/features/notifications-api";

const primaryNav = [
  { to: "/app/radar", label: "Radar", icon: Radar },
  { to: "/app/jobs", label: "Jobs", icon: Search },
  { to: "/app/news", label: "Market Pulse", icon: Newspaper },
  { to: "/app/tracker", label: "Tracker", icon: ListChecks },
  { to: "/app/saved", label: "Saved", icon: Bookmark },
];

const bottomNav = [
  { to: "/app/radar", label: "Radar", icon: Radar },
  { to: "/app/jobs", label: "Jobs", icon: Search },
  { to: "/app/news", label: "Pulse", icon: Newspaper },
  { to: "/app/tracker", label: "Tracker", icon: ListChecks },
  { to: "/app/saved", label: "Saved", icon: Bookmark },
];

export function UserMenu() {
  const { user, isAdmin, logout } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        menuRef.current &&
        !menuRef.current.contains(e.target as Node) &&
        triggerRef.current &&
        !triggerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    }
    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("keydown", handleKeyDown);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  function handleMenuKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    if (!menuRef.current) return;
    const items = Array.from(
      menuRef.current.querySelectorAll<HTMLElement>('[role="menuitem"]:not([disabled])')
    );
    if (!items.length) return;
    const currentIndex = items.indexOf(document.activeElement as HTMLElement);

    if (e.key === "ArrowDown") {
      e.preventDefault();
      const nextIndex = currentIndex < items.length - 1 ? currentIndex + 1 : 0;
      items[nextIndex]?.focus();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      const prevIndex = currentIndex > 0 ? currentIndex - 1 : items.length - 1;
      items[prevIndex]?.focus();
    } else if (e.key === "Home") {
      e.preventDefault();
      items[0]?.focus();
    } else if (e.key === "End") {
      e.preventDefault();
      items[items.length - 1]?.focus();
    }
  }

  async function handleLogout() {
    setLoggingOut(true);
    try {
      await logout();
      setOpen(false);
      navigate("/", { replace: true });
    } catch {
      toast({
        kind: "error",
        message: "Couldn’t sign out. Check your connection and try again.",
        actionLabel: "Retry",
        undo: () => void handleLogout(),
      });
    } finally {
      setLoggingOut(false);
    }
  }

  return (
    <div className="relative">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        aria-haspopup="true"
        aria-label="User account menu"
        className="inline-flex items-center gap-1.5 p-0.5 rounded-full hover:bg-soft transition-colors focus-visible:ring-2 focus-visible:ring-indigo/30 focus-visible:outline-none ml-1"
      >
        <span className="inline-flex items-center justify-center size-9 rounded-full bg-navy text-white text-[13px] font-semibold shadow-sm">
          {user?.initials ?? "RB"}
        </span>
        <ChevronDown size={13} className={classNames("text-slate transition-transform duration-150 hidden sm:inline-block", open ? "rotate-180" : "")} />
      </button>

      {open && (
        <div
          ref={menuRef}
          onKeyDown={handleMenuKeyDown}
          role="menu"
          aria-orientation="vertical"
          className="absolute right-0 mt-2 w-64 rounded-[var(--radius-card)] bg-white border border-line shadow-lg py-2 z-50 animate-in fade-in zoom-in-95 duration-100"
        >
          <div className="px-4 py-2 border-b border-line/60">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-semibold text-ink truncate">{user?.name || "Account"}</p>
              {isAdmin && (
                <span className="text-[10px] font-mono uppercase px-1.5 py-0.5 rounded bg-indigo-tint text-indigo font-bold">
                  Admin
                </span>
              )}
            </div>
            <p className="text-xs text-slate truncate mt-0.5">{user?.email}</p>
          </div>

          <div className="py-1">
            <Link
              to="/app/profile"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2.5 px-4 py-2 text-sm text-ink hover:bg-soft transition-colors"
              role="menuitem"
            >
              <User size={16} className="text-slate" />
              <span>Your profile</span>
            </Link>

            <Link
              to="/app/settings"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2.5 px-4 py-2 text-sm text-ink hover:bg-soft transition-colors"
              role="menuitem"
            >
              <Settings size={16} className="text-slate" />
              <span>Settings</span>
            </Link>

            {isAdmin && (
              <Link
                to="/admin"
                onClick={() => setOpen(false)}
                className="flex items-center gap-2.5 px-4 py-2 text-sm text-indigo hover:bg-indigo-tint/50 transition-colors"
                role="menuitem"
              >
                <Shield size={16} className="text-indigo" />
                <span>Admin console</span>
              </Link>
            )}
          </div>

          <div className="border-t border-line/60 pt-1">
            <button
              type="button"
              onClick={() => void handleLogout()}
              disabled={loggingOut}
              className="w-full flex items-center gap-2.5 px-4 py-2 text-sm text-red hover:bg-red-tint/50 transition-colors disabled:opacity-50 text-left"
              role="menuitem"
            >
              {loggingOut ? (
                <Loader2 size={16} className="animate-spin text-red" />
              ) : (
                <LogOut size={16} className="text-red" />
              )}
              <span>{loggingOut ? "Signing out..." : "Sign out"}</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function AppShell() {
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const { user, isAdmin } = useAuth();
  const navItems = isAdmin ? [...primaryNav, { to: "/admin", label: "Admin", icon: Shield }] : primaryNav;

  useEffect(() => {
    let active = true;
    async function fetchUnread() {
      try {
        const res = await getUnreadCount();
        if (active) setUnreadCount(res.unreadCount);
      } catch {
        // silent fallback
      }
    }
    fetchUnread();
    const timer = setInterval(fetchUnread, 45000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, []);

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
            {navItems.map((item) => (
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
            <NavLink
              to="/app/notifications"
              aria-label={unreadCount > 0 ? `Notifications (${unreadCount} unread)` : "Notifications"}
              className="relative inline-flex items-center justify-center size-10 rounded-[var(--radius-control)] text-slate hover:bg-soft hover:text-ink"
            >
              <Bell size={18} />
              {unreadCount > 0 && (
                <span className="absolute top-2 right-2 flex size-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo opacity-75"></span>
                  <span className="relative inline-flex rounded-full size-2 bg-indigo"></span>
                </span>
              )}
            </NavLink>
            <NavLink to="/app/settings" aria-label="Settings" className="hidden sm:inline-flex items-center justify-center size-10 rounded-[var(--radius-control)] text-slate hover:bg-soft hover:text-ink">
              <Settings size={18} />
            </NavLink>
            {isAdmin && (
              <NavLink
                to="/admin"
                aria-label="Admin console"
                className="md:hidden inline-flex items-center justify-center size-9 rounded-[var(--radius-control)] text-indigo hover:bg-indigo-tint"
              >
                <Shield size={18} />
              </NavLink>
            )}
            <UserMenu />
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
          {[
            { to: "/app/radar", label: "Radar", icon: Radar },
            { to: "/app/jobs", label: "Jobs", icon: Search },
            { to: "/app/tracker", label: "Tracker", icon: ListChecks },
            {
              to: "/app/notifications",
              label: "Alerts",
              icon: Bell,
              badgeCount: unreadCount,
              ariaLabel: unreadCount > 0 ? `Notifications, ${unreadCount} unread` : "Notifications"
            },
            { to: "/app/saved", label: "Saved", icon: Bookmark },
          ].map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              aria-label={(item as any).ariaLabel || item.label}
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
                  <span className="relative inline-flex items-center justify-center">
                    <item.icon size={20} />
                    {"badgeCount" in item && Boolean(item.badgeCount && item.badgeCount > 0) && (
                      <span className="absolute -top-1.5 -right-2 flex size-3 items-center justify-center">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo opacity-75"></span>
                        <span className="relative inline-flex items-center justify-center size-3 rounded-full bg-indigo text-[8px] font-bold text-white leading-none">
                          {item.badgeCount! > 9 ? "9+" : item.badgeCount}
                        </span>
                      </span>
                    )}
                  </span>
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
