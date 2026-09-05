import { useState } from "react";
import { Link } from "react-router";
import {
  Bell,
  Sparkles,
  TrendingUp,
  Clock,
  ShieldAlert,
  CalendarClock,
  CheckCheck,
  Settings2,
  Newspaper,
} from "lucide-react";
import { PageContainer, PageHeader } from "../../components/shell/AppShell";
import { Kicker, Badge, Button, CompanyLogo, EmptyState } from "../../components/ui/primitives";
import { Tabs } from "../../components/ui/form";
import { useToast } from "../../components/ui/toast";
import { relativeTime, classNames } from "../../lib/format";

type Kind = "match" | "momentum" | "freshness" | "deadline" | "eligibility" | "news";
type Note = {
  id: string;
  kind: Kind;
  title: string;
  body: string;
  at: string;
  company?: string;
  to: string;
  unread: boolean;
  labelled?: string;
};

const kindMeta: Record<Kind, { icon: typeof Bell; tint: string; text: string; label: string }> = {
  match: { icon: Sparkles, tint: "bg-indigo-tint", text: "text-indigo", label: "New match" },
  momentum: { icon: TrendingUp, tint: "bg-cyan-tint", text: "text-cyan", label: "Company signal" },
  freshness: { icon: Clock, tint: "bg-soft", text: "text-slate", label: "Freshness" },
  deadline: { icon: CalendarClock, tint: "bg-amber-tint", text: "text-amber", label: "Reminder" },
  eligibility: { icon: ShieldAlert, tint: "bg-amber-tint", text: "text-amber", label: "Eligibility" },
  news: { icon: Newspaper, tint: "bg-cyan-tint", text: "text-cyan", label: "News" },
};

const seed: Note[] = [];

type Filter = "all" | "unread" | "alerts" | "companies";

export function Component() {
  const toast = useToast();
  const [notes, setNotes] = useState(seed);
  const [filter, setFilter] = useState<Filter>("all");

  const unreadCount = notes.filter((n) => n.unread).length;

  const visible = notes.filter((n) => {
    if (filter === "unread") return n.unread;
    if (filter === "alerts") return n.kind === "match";
    if (filter === "companies") return n.kind === "momentum" || n.kind === "news";
    return true;
  });

  function markAllRead() {
    setNotes((prev) => prev.map((n) => ({ ...n, unread: false })));
    toast({ kind: "success", message: "All notifications marked read." });
  }

  return (
    <PageContainer className="max-w-[860px]">
      <PageHeader
        kicker="Notification centre"
        title="What changed while you were away."
        description="Matches, deadlines and company signals — each labelled with why it reached you and whether it's evidence or inference."
        actions={
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" icon={<CheckCheck size={15} />} onClick={markAllRead} disabled={unreadCount === 0}>
              Mark all read
            </Button>
            <Link
              to="/app/settings"
              className="inline-flex items-center justify-center size-9 rounded-[var(--radius-control)] text-slate hover:bg-soft hover:text-ink"
              aria-label="Notification settings"
            >
              <Settings2 size={16} />
            </Link>
          </div>
        }
      />

      <div className="mb-5">
        <Tabs
          value={filter}
          onChange={setFilter}
          tabs={[
            { value: "all", label: "All", count: notes.length },
            { value: "unread", label: "Unread", count: unreadCount },
            { value: "alerts", label: "Alerts" },
            { value: "companies", label: "Companies" },
          ]}
        />
      </div>

      {visible.length === 0 ? (
        <EmptyState icon={<CheckCheck size={40} />} title="You're all caught up" body="No notifications in this view. New matches and signals will land here." />
      ) : (
        <ul className="space-y-2">
          {visible.map((n) => {
            const m = kindMeta[n.kind];
            const Icon = m.icon;
            return (
              <li key={n.id}>
                <Link
                  to={n.to}
                  onClick={() => setNotes((prev) => prev.map((x) => (x.id === n.id ? { ...x, unread: false } : x)))}
                  className={classNames(
                    "flex items-start gap-3.5 rounded-[var(--radius-card)] border p-4 transition-colors",
                    n.unread ? "border-line bg-white hover:border-ink/25" : "border-line/70 bg-soft/40 hover:border-line",
                  )}
                >
                  <span className={classNames("inline-flex items-center justify-center size-9 rounded-[10px] shrink-0", m.tint, m.text)}>
                    <Icon size={17} />
                  </span>
                  <div className="min-w-0 grow">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="kicker">{m.label}</span>
                      {n.labelled && <Badge tone={n.labelled.includes("Inference") || n.labelled.includes("AI") ? "amber" : "indigo"}>{n.labelled}</Badge>}
                      <span className="font-data text-[11px] text-slate">· {relativeTime(n.at)}</span>
                    </div>
                    <p className={classNames("mt-1 leading-snug", n.unread ? "font-semibold text-ink" : "text-ink")}>{n.title}</p>
                    <p className="text-[13px] text-slate mt-1">{n.body}</p>
                    {n.company && (
                      <span className="mt-2 inline-flex items-center gap-1.5 text-[12px] text-slate">
                        <CompanyLogo name={n.company} size={16} /> {n.company}
                      </span>
                    )}
                  </div>
                  {n.unread && <span className="mt-1 size-2 rounded-full bg-indigo shrink-0" aria-label="Unread" />}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </PageContainer>
  );
}
