import { useEffect, useState } from "react";
import { Link } from "react-router";
import { ArrowLeft, Plus, RefreshCw, CheckCircle2, AlertTriangle, ShieldAlert, Settings2 } from "lucide-react";
import { PageContainer, PageHeader } from "../../shared/shell/AppShell";
import { Badge, Button } from "../../ui/primitives";
import { useToast } from "../../ui/toast";
import { relativeTime } from "../../lib/core/format";
import { getAdminSources, triggerSourceSync } from "../../lib/features/admin-api";
import type { AdminSourceItem } from "../../lib/features/admin-api";

const statusMeta = {
  healthy: { tone: "emerald" as const, icon: <CheckCircle2 size={13} />, label: "Healthy" },
  degraded: { tone: "amber" as const, icon: <AlertTriangle size={13} />, label: "Degraded" },
  down: { tone: "red" as const, icon: <ShieldAlert size={13} />, label: "Down" },
};

export function Component() {
  const toast = useToast();
  const [sources, setSources] = useState<AdminSourceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [syncingId, setSyncingId] = useState<string | null>(null);

  async function loadSources(showToast = false) {
    setLoading(true);
    setError("");
    try {
      const res = await getAdminSources();
      setSources(res.sources);
      if (showToast) {
        toast({ kind: "info", message: "Sources refreshed." });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Could not load sources.";
      setError(msg);
      if (showToast) {
        toast({ kind: "error", message: msg });
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadSources();
  }, []);

  async function handleSync(source: AdminSourceItem) {
    setSyncingId(source.id);
    try {
      const res = await triggerSourceSync(source.id);
      toast({
        kind: "success",
        message: `Manual sync enqueued for ${source.name}. (job: ${res.jobId})`
      });
      await loadSources();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Sync failed to enqueue.";
      toast({ kind: "error", message: msg });
    } finally {
      setSyncingId(null);
    }
  }

  return (
    <PageContainer>
      <Link to="/admin" className="text-[13px] text-slate hover:text-ink inline-flex items-center gap-1 mb-4"><ArrowLeft size={14} /> System health</Link>
      <PageHeader
        kicker="Operations · sources"
        title="Ingestion sources."
        description="Enable, disable and monitor every data source feeding the index."
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              disabled={loading}
              onClick={() => void loadSources(true)}
              icon={<RefreshCw size={15} className={loading ? "animate-spin" : ""} />}
            >
              {loading ? "Refreshing..." : "Refresh"}
            </Button>
            <Button icon={<Plus size={16} />} disabled title="Additional source configuration requires codebase provider adapters.">Add source</Button>
          </div>
        }
      />

      {loading && sources.length === 0 ? (
        <div className="rounded-[var(--radius-card)] border border-line p-8 text-sm text-slate">Loading ingestion sources...</div>
      ) : error && sources.length === 0 ? (
        <div className="rounded-[var(--radius-card)] border border-red/30 bg-red-tint/40 p-8 text-sm text-red">{error}</div>
      ) : (
        <div className="space-y-3">
          {sources.map((s) => {
            const m = statusMeta[s.status];
            const isSyncing = syncingId === s.id;
            return (
              <div key={s.id} className="rounded-[var(--radius-card)] border border-line p-5 flex flex-wrap items-center gap-4">
                <div className="grow min-w-[220px]">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-ink">{s.name}</h3>
                    <Badge tone={m.tone}>{m.icon} {m.label}</Badge>
                    {!s.enabled && <Badge tone="slate">Disabled</Badge>}
                    <span className="text-[11px] text-slate font-data uppercase">id: {s.id}</span>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-x-5 gap-y-1 text-[12px] text-slate font-data">
                    <span>{s.kind}</span>
                    <span>{s.region}</span>
                    <span>Last sync {s.lastRun ? relativeTime(s.lastRun.startedAt) : "none"}</span>
                    <span>Cron: {s.cronSchedule ?? "none"}</span>
                    <span>Last 24h: {s.stats24h.runs} runs ({s.stats24h.failures} failed)</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    icon={<RefreshCw size={14} className={isSyncing ? "animate-spin" : ""} />}
                    disabled={isSyncing || !s.enabled}
                    onClick={() => void handleSync(s)}
                    title={!s.enabled ? "Provider is currently disabled" : "Trigger immediate ingestion job"}
                  >
                    {isSyncing ? "Syncing..." : "Sync now"}
                  </Button>
                  <Button variant="tertiary" size="sm" icon={<Settings2 size={14} />} disabled title="Provider settings are managed via production environment configuration.">Configure</Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </PageContainer>
  );
}
