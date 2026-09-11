import { useEffect, useState } from "react";
import { Link } from "react-router";
import { ArrowLeft, Flag, ShieldAlert, Check, X, ExternalLink, MapPin, RefreshCw, AlertTriangle } from "lucide-react";
import { PageContainer, PageHeader } from "../../shared/shell/AppShell";
import { Kicker, Badge, Button, CompanyLogo, EmptyState } from "../../ui/primitives";
import { Tabs } from "../../ui/form";
import { Dialog } from "../../ui/overlay";
import { useToast } from "../../ui/toast";
import { relativeTime } from "../../lib/core/format";
import { getModerationQueue, executeModerationAction } from "../../lib/features/admin-api";
import type { ModerationQueueItem } from "../../lib/features/admin-api";

type Tab = "reports" | "suspicious" | "stale" | "expired";

export function Component() {
  const toast = useToast();
  const [tab, setTab] = useState<Tab>("suspicious");
  const [items, setItems] = useState<ModerationQueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Accessible confirmation dialog state
  const [pendingAction, setPendingAction] = useState<{
    item: ModerationQueueItem;
    action: "APPROVE" | "EXPIRE" | "DISMISS" | "REMOVE";
    title: string;
    description: string;
    variant: "destructive" | "primary" | "secondary";
  } | null>(null);
  const [actionNotes, setActionNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function loadQueue(showToast = false) {
    setLoading(true);
    setError("");
    try {
      const res = await getModerationQueue({ tab, limit: 50 });
      setItems(res.items);
      if (showToast) {
        toast({ kind: "info", message: "Moderation queue refreshed." });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Could not load moderation queue.";
      setError(msg);
      if (showToast) {
        toast({ kind: "error", message: msg });
      }
    } finally {
      setLoading(false);
    }
  }


  useEffect(() => {
    void loadQueue();
  }, [tab]);

  async function confirmAction() {
    if (!pendingAction) return;
    setSubmitting(true);
    try {
      await executeModerationAction(
        pendingAction.item.id,
        pendingAction.action,
        actionNotes.trim() || undefined
      );
      toast({
        kind: "success",
        message: `Action ${pendingAction.action} completed for "${pendingAction.item.title}".`
      });
      setPendingAction(null);
      setActionNotes("");
      await loadQueue();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Action failed.";
      toast({ kind: "error", message: msg });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <PageContainer className="max-w-[980px]">
      <Link to="/admin" className="text-[13px] text-slate hover:text-ink inline-flex items-center gap-1 mb-4"><ArrowLeft size={14} /> System health</Link>
      <PageHeader
        kicker="Operations · moderation"
        title="Keep the index trustworthy."
        description="Review suspected fraudulent listings, stale roles, and user-reported flags. All actions record detailed audit events."
        actions={
          <Button
            variant="secondary"
            disabled={loading}
            onClick={() => void loadQueue(true)}
            icon={<RefreshCw size={15} className={loading ? "animate-spin" : ""} />}
          >
            {loading ? "Refreshing..." : "Refresh"}
          </Button>
        }
      />

      <div className="mb-6">
        <Tabs
          value={tab}
          onChange={(v) => setTab(v as Tab)}
          tabs={[
            { value: "suspicious", label: "Suspicious", count: tab === "suspicious" ? items.length : undefined },
            { value: "reports", label: "Flagged / Reports", count: tab === "reports" ? items.length : undefined },
            { value: "stale", label: "Stale", count: tab === "stale" ? items.length : undefined },
            { value: "expired", label: "Expired", count: tab === "expired" ? items.length : undefined },
          ]}
        />
      </div>

      {loading && items.length === 0 ? (
        <div className="rounded-[var(--radius-card)] border border-line p-8 text-sm text-slate">Loading moderation queue...</div>
      ) : error && items.length === 0 ? (
        <div className="rounded-[var(--radius-card)] border border-red/30 bg-red-tint/40 p-8 text-sm text-red">{error}</div>
      ) : items.length === 0 ? (
        <EmptyState icon={<Check size={40} />} title="Queue clear" body={`No open ${tab} listings at this time.`} />
      ) : (
        <div className="space-y-4">
          {items.map((item) => (
            <ModerationCard
              key={item.id}
              item={item}
              onRequestAction={(action, title, description, variant) => {
                setPendingAction({ item, action, title, description, variant });
                setActionNotes("");
              }}
            />
          ))}
        </div>
      )}

      {/* Accessible Confirmation Modal Dialog - No window.confirm */}
      <Dialog
        open={Boolean(pendingAction)}
        onClose={() => { if (!submitting) setPendingAction(null); }}
        title={pendingAction ? pendingAction.title : "Confirm Action"}
        footer={
          <>
            <Button
              variant="tertiary"
              disabled={submitting}
              onClick={() => setPendingAction(null)}
            >
              Cancel
            </Button>
            <Button
              variant={pendingAction ? pendingAction.variant : "primary"}
              disabled={submitting}
              onClick={() => void confirmAction()}
            >
              {submitting ? "Executing..." : "Confirm Action"}
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <p className="text-sm text-ink/90">{pendingAction?.description}</p>
          <div className="rounded-[var(--radius-control)] bg-soft p-3 text-sm">
            <p className="font-semibold text-ink">{pendingAction?.item.title}</p>
            <p className="text-[13px] text-slate">{pendingAction?.item.company} · {pendingAction?.item.location}</p>
          </div>
          <div>
            <label htmlFor="admin-notes" className="block text-[13px] font-medium text-ink mb-1">
              Audit notes (optional)
            </label>
            <textarea
              id="admin-notes"
              className="w-full rounded-[var(--radius-control)] border border-line text-sm p-2.5 h-20 resize-none"
              placeholder="Reason for moderation action, signal observations..."
              value={actionNotes}
              onChange={(e) => setActionNotes(e.target.value)}
              disabled={submitting}
            />
          </div>
        </div>
      </Dialog>
    </PageContainer>
  );
}

function ModerationCard({
  item,
  onRequestAction
}: {
  item: ModerationQueueItem;
  onRequestAction: (
    action: "APPROVE" | "EXPIRE" | "DISMISS" | "REMOVE",
    title: string,
    description: string,
    variant: "destructive" | "primary" | "secondary"
  ) => void;
}) {
  return (
    <div className="rounded-[var(--radius-card)] border border-line p-5">
      <div className="flex items-start gap-3">
        <CompanyLogo name={item.company} size={40} />
        <div className="grow min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-semibold text-ink">{item.title}</h3>
            <Badge tone={item.severity === "high" ? "red" : "amber"}>
              {item.severity === "high" ? <ShieldAlert size={13} /> : <Flag size={13} />} {item.reason}
            </Badge>
            <Badge tone="slate">{item.provider}</Badge>
            <Badge tone="slate">{item.status}</Badge>
          </div>
          <p className="text-[13px] text-slate">{item.company}</p>
          <p className="text-[12px] text-slate inline-flex items-center gap-1 mt-0.5">
            <MapPin size={12} /> {item.location} · discovered {relativeTime(item.discoveredAt)}
          </p>
        </div>
      </div>
      <div className="mt-4 pt-3 border-t border-line flex flex-wrap items-center gap-2">
        <Button
          variant="destructive"
          size="sm"
          icon={<X size={14} />}
          onClick={() => onRequestAction("REMOVE", "Remove Listing", "Are you sure you want to remove this job from RoleBrief? It will be expired and its moderation state set to removed.", "destructive")}
        >
          Remove listing
        </Button>
        <Button
          variant="secondary"
          size="sm"
          icon={<AlertTriangle size={14} />}
          onClick={() => onRequestAction("EXPIRE", "Expire Listing", "Mark this role as expired? It will no longer appear in active streams or alerts.", "secondary")}
        >
          Expire
        </Button>
        <Button
          variant="tertiary"
          size="sm"
          icon={<Check size={14} />}
          onClick={() => onRequestAction("APPROVE", "Approve Listing", "Approve this listing as legitimate? It will be set to active and approved.", "primary")}
        >
          Approve
        </Button>
        {item.listingUrl ? (
          <a
            href={item.listingUrl}
            target="_blank"
            rel="noreferrer noopener"
            className="ml-auto text-[13px] text-indigo hover:text-indigo-strong inline-flex items-center gap-1 font-medium"
          >
            View listing <ExternalLink size={13} />
          </a>
        ) : item.slug ? (
          <Link
            to={`/jobs/${item.slug}`}
            target="_blank"
            rel="noreferrer"
            className="ml-auto text-[13px] text-indigo hover:text-indigo-strong inline-flex items-center gap-1 font-medium"
          >
            View role <ExternalLink size={13} />
          </Link>
        ) : (
          <span className="ml-auto text-[13px] text-slate inline-flex items-center gap-1 cursor-not-allowed">
            Listing unavailable
          </span>
        )}
      </div>
    </div>
  );
}
