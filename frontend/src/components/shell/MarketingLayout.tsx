import { Outlet, Link, NavLink, ScrollRestoration } from "react-router";
import { Wordmark } from "../rolebrief/Wordmark";
import { LinkButton } from "../ui/primitives";
import { classNames } from "../../lib/format";

const links = [
  { to: "/how-it-works#radar", label: "Radar" },
  { to: "/how-it-works", label: "How it works" },
  { to: "/coverage", label: "Coverage" },
  { to: "/news", label: "Market Pulse" },
];

export default function MarketingLayout() {
  return (
    <div className="min-h-full paper-grain text-ink flex flex-col">
      <header className="sticky top-0 z-40 bg-paper/85 backdrop-blur border-b border-line/70">
        <div className="mx-auto max-w-[1248px] px-5 sm:px-8 h-16 flex items-center gap-6">
          <Link to="/" aria-label="RoleBrief home">
            <Wordmark />
          </Link>
          <nav className="hidden md:flex items-center gap-1 ml-4">
            {links.map((l) => (
              <a key={l.label} href={l.to} className="px-3 h-9 inline-flex items-center text-sm text-slate hover:text-ink rounded-[var(--radius-control)] hover:bg-ink/5 transition-colors">
                {l.label}
              </a>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <NavLink to="/login" className="hidden sm:inline-flex items-center h-10 px-3 text-sm font-medium text-ink hover:bg-ink/5 rounded-[var(--radius-control)]">
              Log in
            </NavLink>
            <LinkButton to="/signup" size="md">
              Get started
            </LinkButton>
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
        { label: "How it works", to: "/how-it-works" },
        { label: "Jobs", to: "/jobs" },
        { label: "Market Pulse", to: "/news" },
        { label: "Coverage", to: "/coverage" },
      ],
    },
    {
      title: "Signature",
      items: [
        { label: "Eligibility Shield", to: "/how-it-works#signals" },
        { label: "Match Brief", to: "/how-it-works#signals" },
        { label: "Freshness Timeline", to: "/how-it-works#signals" },
        { label: "Company Momentum", to: "/how-it-works#signals" },
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
        <div className={classNames("mt-12 pt-6 border-t border-line/70 flex flex-wrap items-center justify-between gap-3 text-[13px] text-slate")}>
          <span>© 2026 RoleBrief. Coverage: Pakistan · UAE · worldwide remote.</span>
          <span className="font-data">Every listing is source-linked and freshness-stamped.</span>
        </div>
      </div>
    </footer>
  );
}
