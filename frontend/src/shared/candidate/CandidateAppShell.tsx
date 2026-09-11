import { useEffect, useRef, useState } from "react";
import {
  Link,
  NavLink,
  Outlet,
  ScrollRestoration,
  useLocation,
} from "react-router";
import {
  ArrowUpRight,
  Bell,
  Bookmark,
  BriefcaseBusiness,
  ChevronRight,
  Layers,
  Menu,
  Newspaper,
  Radar,
  Search,
  Settings2,
  UserRound,
  X,
} from "lucide-react";
import { useAuth } from "../../lib/auth/auth";
import { UserMenu } from "../shell/AppShell";
import "./candidate.css";

const navigation = [
  { to: "/app/radar", label: "Radar", icon: Radar },
  { to: "/app/jobs", label: "Jobs", icon: Search },
  { to: "/app/news", label: "Market Pulse", icon: Newspaper },
  { to: "/app/saved", label: "Saved", icon: Bookmark },
  { to: "/app/tracker", label: "Tracker", icon: BriefcaseBusiness },
  { to: "/app/alerts", label: "Alerts", icon: Bell },
];
const personal = [
  { to: "/app/profile", label: "Profile", icon: UserRound },
  { to: "/app/settings", label: "Settings", icon: Settings2 },
];

function CandidateSidebar({ close }: { close?: () => void }) {
  const { user } = useAuth();
  return (
    <>
      <Link to="/app/radar" className="candidate-brand" onClick={close}>
        <Layers size={23} strokeWidth={1.5} />
        <span>
          RoleBrief<span>.</span>
        </span>
      </Link>
      <Link to="/app/jobs" className="candidate-search" onClick={close}>
        <Search size={15} />
        <span>Find an opportunity</span>
        <ArrowUpRight size={13} />
      </Link>
      <nav aria-label="Candidate workspace">
        <p className="candidate-nav-label">Workspace</p>
        {navigation.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            onClick={close}
            className={({ isActive }) =>
              `candidate-nav-link${isActive ? " is-active" : ""}`
            }
          >
            <Icon size={17} strokeWidth={1.6} />
            <span>{label}</span>
            {label === "Radar" && <span className="candidate-active-mark" />}
          </NavLink>
        ))}
        <p className="candidate-nav-label candidate-personal-label">Personal</p>
        {personal.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            onClick={close}
            className={({ isActive }) =>
              `candidate-nav-link${isActive ? " is-active" : ""}`
            }
          >
            <Icon size={16} strokeWidth={1.6} />
            {label}
          </NavLink>
        ))}
      </nav>
      <div className="candidate-sidebar-bottom">
        <Link
          to="/sources-methodology"
          className="candidate-methodology"
          onClick={close}
        >
          <Layers size={14} /> Sources & methodology <ArrowUpRight size={12} />
        </Link>
        <div className="candidate-identity">
          <span className="candidate-initials">{user?.initials || "You"}</span>
          <div>
            <strong>{user?.name || "Your account"}</strong>
            <span>Personal workspace</span>
          </div>
        </div>
      </div>
    </>
  );
}

export default function CandidateAppShell() {
  const { pathname } = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const current =
    [...navigation, ...personal].find((item) => pathname.startsWith(item.to))
      ?.label ||
    (pathname.includes("notifications") ? "Notifications" : "Workspace");
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);
  useEffect(() => {
    if (mobileOpen) {
      dialog.current?.showModal();
      const before = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = before;
        dialog.current?.close();
      };
    }
    dialog.current?.close();
  }, [mobileOpen]);
  function closeDrawer() {
    setMobileOpen(false);
    trigger.current?.focus();
  }
  return (
    <div className="candidate-app">
      <a href="#candidate-main" className="candidate-skip">
        Skip to content
      </a>
      <aside className="candidate-sidebar">
        <CandidateSidebar />
      </aside>
      <dialog
        ref={dialog}
        className="candidate-drawer"
        aria-label="Workspace navigation"
        onCancel={(e) => {
          e.preventDefault();
          closeDrawer();
        }}
        onClick={(e) => {
          if (e.target === dialog.current) closeDrawer();
        }}
      >
        <button
          className="candidate-icon candidate-drawer-close"
          onClick={closeDrawer}
          aria-label="Close navigation"
        >
          <X size={20} />
        </button>
        <CandidateSidebar close={closeDrawer} />
      </dialog>
      <div className="candidate-main-area">
        <header className="candidate-topbar">
          <div className="candidate-breadcrumb">
            <button
              ref={trigger}
              className="candidate-icon candidate-mobile-menu"
              onClick={() => setMobileOpen(true)}
              aria-label="Open navigation"
              aria-expanded={mobileOpen}
            >
              <Menu size={19} />
            </button>
            <span>Workspace</span>
            <ChevronRight size={12} />
            <strong>{current}</strong>
          </div>
          <div className="candidate-topbar-actions">
            <Link
              to="/app/notifications"
              className="candidate-icon"
              aria-label="Notifications"
              title="Notifications"
            >
              <Bell size={17} />
            </Link>
            <span className="candidate-topbar-divider" />
            <UserMenu />
          </div>
        </header>
        <main id="candidate-main" className="candidate-main" tabIndex={-1}>
          <Outlet />
        </main>
      </div>
      <nav className="candidate-mobile-nav" aria-label="Mobile workspace">
        {navigation
          .filter((item) =>
            ["Radar", "Jobs", "Saved", "Tracker"].includes(item.label),
          )
          .map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) => (isActive ? "is-active" : "")}
            >
              <Icon size={19} />
              <span>{label}</span>
            </NavLink>
          ))}
        <button
          onClick={() => setMobileOpen(true)}
          aria-label="More navigation"
          aria-expanded={mobileOpen}
        >
          <Menu size={19} />
          <span>More</span>
        </button>
      </nav>
      <ScrollRestoration />
    </div>
  );
}

