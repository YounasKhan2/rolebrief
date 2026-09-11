import { useState, useEffect, useCallback } from "react";
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
  Loader2,
  RefreshCw,
  ExternalLink
} from "lucide-react";
import { PageContainer, PageHeader } from "../../components/shell/AppShell";
import "../../components/candidate/candidate-account.css";
import { Badge, Button, EmptyState } from "../../components/ui/primitives";
import { Tabs } from "../../components/ui/form";
import { useToast } from "../../components/ui/toast";
import { relativeTime, classNames } from "../../lib/format";
import {
  getNotifications,
  markAsRead,
  markAllAsRead,
  type SerializedNotification
} from "../../lib/notifications-api";

type Filter = "all" | "unread" | "matches";

export function Component() {
  const toast = useToast();
  const [notifications, setNotifications] = useState<SerializedNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>("all");
  const [unreadCount, setUnreadCount] = useState(0);
  const [markingAll, setMarkingAll] = useState(false);

  const fetchNotes = useCallback(async () => {
    try {
      setLoading(true);
      const res = await getNotifications({ limit: 50 });
      setNotifications(res.items);
      setUnreadCount(res.unreadCount);
    } catch (err: any) {
      toast({
        kind: "error",
        message: err.message || "Failed to load notifications."
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchNotes();
  }, [fetchNotes]);

  async function handleMarkAllRead() {
    setMarkingAll(true);
    try {
      await markAllAsRead();
      setNotifications((prev) =>
        prev.map((n) => ({ ...n, readAt: n.readAt || new Date().toISOString() }))
      );
      setUnreadCount(0);
      toast({ kind: "success", message: "All notifications marked as read." });
    } catch (err: any) {
      toast({
        kind: "error",
        message: err.message || "Failed to mark all as read."
      });
    } finally {
      setMarkingAll(false);
    }
  }

  async function handleNotificationClick(note: SerializedNotification) {
    if (!note.readAt) {
      try {
        await markAsRead(note.id);
        setNotifications((prev) =>
          prev.map((n) => (n.id === note.id ? { ...n, readAt: new Date().toISOString() } : n))
        );
        setUnreadCount((c) => Math.max(0, c - 1));
      } catch {
        // non-blocking
      }
    }
  }

  const visible = notifications.filter((n) => {
    if (filter === "unread") return !n.readAt;
    if (filter === "matches") return n.type === "ALERT_MATCH" || n.type === "MATCH_ALERT";
    return true;
  });

  return (
    <PageContainer className="candidate-account candidate-notifications">
      <PageHeader
        title="Notifications"
        description="Updates from alerts, saved roles, tracker activity, and account events."
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              icon={<RefreshCw size={14} className={loading ? "animate-spin" : ""} />}
              onClick={fetchNotes}
              disabled={loading}
            >
              Refresh
            </Button>
            <Button
              variant="secondary"
              size="sm"
              icon={<CheckCheck size={15} />}
              onClick={handleMarkAllRead}
              disabled={markingAll || unreadCount === 0}
            >
              {markingAll ? "Marking..." : "Mark all read"}
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
            { value: "all", label: "All", count: notifications.length },
            { value: "unread", label: "Unread", count: unreadCount },
            { value: "matches", label: "Matches" }
          ]}
        />
      </div>

      {loading && notifications.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-slate">
          <Loader2 size={32} className="animate-spin text-indigo mb-3" />
          <p className="text-sm">Loading notifications...</p>
        </div>
      ) : visible.length === 0 ? (
        <EmptyState
          icon={<CheckCheck size={40} />}
          title="You're all caught up"
          body="No notifications in this view. Fresh alert matches will arrive here."
        />
      ) : (
        <ul className="space-y-2">
          {visible.map((n) => {
            const isUnread = !n.readAt;
            const link = n.linkUrl || "#";

            return (
              <li key={n.id} className={isUnread ? "candidate-notification is-unread" : "candidate-notification"}>
                <Link
                  to={link}
                  onClick={() => handleNotificationClick(n)}
                  className={classNames(
                    "flex items-start gap-3.5 rounded-[var(--radius-card)] border p-4 transition-colors",
                    isUnread
                      ? "border-line bg-white hover:border-ink/25 shadow-xs"
                      : "border-line/70 bg-soft/40 hover:border-line"
                  )}
                >
                  <span
                    className={classNames(
                      "inline-flex items-center justify-center size-9 rounded-[10px] shrink-0",
                      isUnread ? "bg-indigo-tint text-indigo" : "bg-soft text-slate"
                    )}
                  >
                    <Sparkles size={17} />
                  </span>
                  <div className="min-w-0 grow">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="kicker">
                        {n.type === "ALERT_MATCH" ? "Alert match" : "Update"}
                      </span>
                      {n.metadata?.alignmentScore && (
                        <Badge tone="indigo">
                          Alignment {String(n.metadata.alignmentScore)}%
                        </Badge>
                      )}
                      {n.metadata?.eligibilityState && (
                        <Badge tone="emerald">
                          {String(n.metadata.eligibilityState)}
                        </Badge>
                      )}
                      <span className="font-data text-[11px] text-slate">
                        · {relativeTime(n.createdAt)}
                      </span>
                    </div>
                    <p
                      className={classNames(
                        "mt-1 leading-snug",
                        isUnread ? "font-semibold text-ink" : "text-ink"
                      )}
                    >
                      {n.title}
                    </p>
                    <p className="text-[13px] text-slate mt-1">{n.body}</p>
                  </div>
                  {isUnread && (
                    <span className="mt-1 size-2 rounded-full bg-indigo shrink-0" aria-label="Unread" />
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </PageContainer>
  );
}
