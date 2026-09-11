import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router";
import {
  Search,
  Radar,
  Newspaper,
  ListChecks,
  Bookmark,
  Bell,
  User,
  Settings,
  GitCompareArrows,
  BookOpen,
  Briefcase,
  Building2,
  CornerDownLeft,
  ArrowRight,
  LogOut,
  Shield,
} from "lucide-react";
import { jobs, companies, news, companyName } from "../../lib/core/fixtures";
import { classNames } from "../../lib/core/format";
import { CompanyLogo } from "../../ui/primitives";
import { useAuth } from "../../lib/auth/auth";
import { useToast } from "../../ui/toast";

type Item = {
  id: string;
  label: string;
  sub?: string;
  group: string;
  to: string;
  icon: React.ReactNode;
  keywords?: string;
  action?: () => void;
};

const navItems: Item[] = [
  { id: "n-radar", label: "Radar", sub: "Your ranked briefing", group: "Go to", to: "/app/radar", icon: <Radar size={16} /> },
  { id: "n-jobs", label: "Jobs", sub: "Search and filter roles", group: "Go to", to: "/app/jobs", icon: <Search size={16} /> },
  { id: "n-news", label: "Market Pulse", sub: "Career news", group: "Go to", to: "/app/news", icon: <Newspaper size={16} /> },
  { id: "n-tracker", label: "Tracker", sub: "Your applications", group: "Go to", to: "/app/tracker", icon: <ListChecks size={16} /> },
  { id: "n-saved", label: "Saved briefs", group: "Go to", to: "/app/saved", icon: <Bookmark size={16} /> },
  { id: "n-alerts", label: "Smart Alerts", group: "Go to", to: "/app/alerts", icon: <Bell size={16} /> },
  { id: "n-compare", label: "Compare briefs", sub: "Weigh 2–3 opportunities", group: "Go to", to: "/app/compare", icon: <GitCompareArrows size={16} /> },
  { id: "n-notes", label: "Notifications", group: "Go to", to: "/app/notifications", icon: <Bell size={16} /> },
  { id: "n-profile", label: "Profile", group: "Go to", to: "/app/profile", icon: <User size={16} /> },
  { id: "n-settings", label: "Settings", group: "Go to", to: "/app/settings", icon: <Settings size={16} /> },
  { id: "n-method", label: "Sources & methodology", sub: "How RoleBrief works", group: "Go to", to: "/sources-methodology", icon: <BookOpen size={16} /> },
];

const jobItems: Item[] = jobs.map((j) => ({
  id: `j-${j.slug}`,
  label: j.title,
  sub: `${companyName(j.companySlug)} · ${j.locations[0]}`,
  group: "Roles",
  to: `/jobs/${j.slug}`,
  icon: <Briefcase size={16} />,
  keywords: `${j.discipline} ${j.skills.join(" ")} ${j.seniority}`,
}));

const companyItems: Item[] = companies.map((c) => ({
  id: `c-${c.slug}`,
  label: c.name,
  sub: c.sector,
  group: "Companies",
  to: `/companies/${c.slug}`,
  icon: <Building2 size={16} />,
  keywords: c.locations.join(" "),
}));

const newsItems: Item[] = news.map((n) => ({
  id: `w-${n.slug}`,
  label: n.headline,
  sub: `${n.publisher} · ${n.category}`,
  group: "News",
  to: `/app/news/${n.slug}`,
  icon: <Newspaper size={16} />,
}));

const adminItems: Item[] = [
  { id: "n-admin", label: "Admin console", sub: "System health & user operations", group: "Admin", to: "/admin", icon: <Shield size={16} />, keywords: "admin console users operations health" },
  { id: "n-admin-sources", label: "Ingestion sources", sub: "Provider configuration & health", group: "Admin", to: "/admin/sources", icon: <Shield size={16} />, keywords: "admin sources providers himalayas sync" },
  { id: "n-admin-moderation", label: "Moderation queue", sub: "Reports, suspicious roles & deduplication", group: "Admin", to: "/admin/moderation", icon: <Shield size={16} />, keywords: "admin moderation reports fraud duplicate" },
];

export function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const navigate = useNavigate();
  const toast = useToast();
  const { logout, isAuthenticated, isAdmin } = useAuth();
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleLogout() {
    try {
      await logout();
      navigate("/", { replace: true });
    } catch {
      toast({
        kind: "error",
        message: "Couldn’t sign out. Check your connection and try again.",
        actionLabel: "Retry",
        undo: () => void handleLogout(),
      });
    }
  }

  const accountItems = useMemo<Item[]>(() => {
    if (!isAuthenticated) return [];
    return [
      {
        id: "a-logout",
        label: "Sign out",
        sub: "Sign out of your RoleBrief session",
        group: "Account",
        to: "",
        icon: <LogOut size={16} className="text-red" />,
        keywords: "sign out log out logout disconnect leave exit",
        action: () => void handleLogout(),
      },
    ];
  }, [isAuthenticated, logout]);

  const activeNavItems = useMemo<Item[]>(() => {
    return isAdmin ? [...navItems, ...adminItems] : navItems;
  }, [isAdmin]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    const items = [...activeNavItems, ...jobItems, ...companyItems, ...newsItems, ...accountItems];
    if (!q) return [...activeNavItems, ...accountItems];
    return items
      .filter((i) => `${i.label} ${i.sub ?? ""} ${i.keywords ?? ""} ${i.group}`.toLowerCase().includes(q))
      .slice(0, 12);
  }, [query, activeNavItems, accountItems]);

  useEffect(() => {
    setActive(0);
  }, [query]);

  useEffect(() => {
    if (open) {
      setQuery("");
      setActive(0);
      // focus after paint
      const t = window.setTimeout(() => inputRef.current?.focus(), 20);
      return () => window.clearTimeout(t);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  if (!open) return null;

  function go(item: Item) {
    onClose();
    if (item.action) {
      item.action();
    } else if (item.to) {
      navigate(item.to);
    }
  }

  const grouped = results.reduce<Record<string, Item[]>>((acc, item) => {
    (acc[item.group] ||= []).push(item);
    return acc;
  }, {});

  let flatIndex = -1;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-start justify-center px-4 pt-[12vh]"
      role="dialog"
      aria-modal="true"
      aria-label="Search RoleBrief"
      onKeyDown={(e) => {
        if (e.key === "Escape") onClose();
        else if (e.key === "ArrowDown") {
          e.preventDefault();
          setActive((a) => Math.min(a + 1, results.length - 1));
        } else if (e.key === "ArrowUp") {
          e.preventDefault();
          setActive((a) => Math.max(a - 1, 0));
        } else if (e.key === "Enter") {
          e.preventDefault();
          if (results[active]) go(results[active]);
        }
      }}
    >
      <div className="absolute inset-0 bg-navy/25 backdrop-blur-[2px]" onClick={onClose} aria-hidden />
      <div className="relative w-full max-w-[620px] rounded-[var(--radius-feature)] border border-line bg-white shadow-[var(--shadow-sheet)] overflow-hidden">
        <div className="flex items-center gap-3 px-4 border-b border-line">
          <Search size={18} className="text-slate shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search roles, companies, news or jump to a page…"
            className="w-full h-14 bg-transparent text-[15px] text-ink placeholder:text-slate/70 focus:outline-none"
          />
          <kbd className="font-data text-[11px] text-slate bg-soft rounded px-1.5 py-0.5 shrink-0">Esc</kbd>
        </div>

        <div className="max-h-[52vh] overflow-y-auto scrollbar-thin py-2">
          {results.length === 0 ? (
            <p className="px-4 py-10 text-center text-sm text-slate">
              No matches for "{query}". Try a skill, company or region.
            </p>
          ) : (
            Object.entries(grouped).map(([group, items]) => (
              <div key={group} className="px-2 pb-1">
                <p className="kicker px-2 pt-2 pb-1">{group}</p>
                {items.map((item) => {
                  flatIndex += 1;
                  const idx = flatIndex;
                  const isCompany = item.id.startsWith("c-");
                  return (
                    <button
                      key={item.id}
                      onClick={() => go(item)}
                      onMouseMove={() => setActive(idx)}
                      className={classNames(
                        "w-full flex items-center gap-3 px-2.5 py-2 rounded-[var(--radius-control)] text-left transition-colors",
                        idx === active ? "bg-indigo-tint" : "hover:bg-soft",
                      )}
                    >
                      <span className="text-slate shrink-0">
                        {isCompany ? <CompanyLogo name={item.label} size={22} /> : item.icon}
                      </span>
                      <span className="min-w-0 grow">
                        <span className="block text-sm text-ink truncate">{item.label}</span>
                        {item.sub && <span className="block text-[12px] text-slate truncate">{item.sub}</span>}
                      </span>
                      {idx === active && <CornerDownLeft size={14} className="text-indigo shrink-0" />}
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>

        <div className="flex items-center justify-between gap-3 px-4 py-2.5 border-t border-line bg-soft/40 text-[12px] text-slate">
          <span className="inline-flex items-center gap-3 font-data">
            <span>↑↓ navigate</span>
            <span className="inline-flex items-center gap-1"><CornerDownLeft size={12} /> open</span>
          </span>
          <button
            type="button"
            onClick={() => {
              onClose();
              const q = query.trim();
              const jobsBase = isAuthenticated ? "/app/jobs" : "/jobs";
              navigate(q ? `${jobsBase}?q=${encodeURIComponent(q)}` : jobsBase);
            }}
            className="inline-flex items-center gap-1 text-[12px] text-indigo hover:text-indigo-strong font-medium transition-colors focus-visible:outline-none focus-visible:underline"
          >
            Full search in Jobs <ArrowRight size={12} />
          </button>
        </div>
      </div>
    </div>
  );
}
