import { Link } from "react-router";
import { useEffect, useState } from "react";
import { Activity, AlertTriangle, CheckCircle2, Database, RefreshCw, ShieldAlert, Layers, ArrowRight } from "lucide-react";
import { PageContainer, PageHeader } from "../../components/shell/AppShell";
import { Kicker, Badge, Button, SectionRule } from "../../components/ui/primitives";
import { companies } from "../../lib/fixtures";
import { relativeTime } from "../../lib/format";
import { useToast } from "../../components/ui/toast";
import { useAuth } from "../../lib/auth";
import * as authApi from "../../lib/auth-api";
import type { AdminUser, AuthRole, AuthStatus } from "../../lib/auth-api";
import { getAdminMetrics, getAdminSources } from "../../lib/admin-api";
import type { AdminMetrics, AdminSourceItem } from "../../lib/admin-api";

const providers = [
  { name: "Himalayas provider", status: "healthy" as const, lastSync: new Date().toISOString(), ingested: 0, failed: 0 },
];

const statusMeta = {
  healthy: { tone: "emerald" as const, icon: <CheckCircle2 size={13} />, label: "Healthy" },
  degraded: { tone: "amber" as const, icon: <AlertTriangle size={13} />, label: "Degraded" },
  down: { tone: "red" as const, icon: <ShieldAlert size={13} />, label: "Down" },
};

function Stat({ label, value, hint, tone }: { label: string; value: string; hint?: string; tone?: string }) {
  return (
    <div className="rounded-[var(--radius-card)] border border-line p-4">
      <Kicker>{label}</Kicker>
      <p className={`mt-1 font-data text-2xl ${tone ?? "text-ink"}`}>{value}</p>
      {hint && <p className="text-[12px] text-slate mt-0.5">{hint}</p>}
    </div>
  );
}

export function Component() {
  const { user } = useAuth();
  const toast = useToast();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [metrics, setMetrics] = useState<AdminMetrics | null>(null);
  const [sources, setSources] = useState<AdminSourceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function loadAdminData(showSuccessToast = false) {
    setLoading(true);
    setError("");
    try {
      const [usersRes, metricsRes, sourcesRes] = await Promise.all([
        authApi.listAdminUsers(),
        getAdminMetrics(),
        getAdminSources()
      ]);
      setUsers(usersRes.users);
      setMetrics(metricsRes);
      setSources(sourcesRes.sources);
      if (showSuccessToast) {
        toast({ kind: "info", message: "Admin data refreshed." });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Could not load admin data.";
      setError(msg);
      if (showSuccessToast) {
        toast({ kind: "error", message: msg });
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadAdminData();
  }, []);

  async function updateRole(target: AdminUser, role: AuthRole) {
    if (!window.confirm(`Change ${target.email} to ${role}?`)) return;
    await authApi.updateAdminUserRole(target.id, role);
    await loadAdminData();
  }

  async function updateStatus(target: AdminUser, status: AuthStatus) {
    if (!window.confirm(`Change ${target.email} status to ${status}?`)) return;
    await authApi.updateAdminUserStatus(target.id, status);
    await loadAdminData();
  }

  return (
    <PageContainer>
      <PageHeader
        kicker="Operations · internal"
        title="System health & ingestion."
        description={`Signed in as ${user?.email ?? "administrator"}. Provider status, ingestion volume and data quality across the pipeline.`}
        actions={
          <Button
            variant="secondary"
            disabled={loading}
            onClick={() => void loadAdminData(true)}
            icon={<RefreshCw size={16} className={loading ? "animate-spin" : ""} />}
          >
            {loading ? "Refreshing..." : "Refresh now"}
          </Button>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <Stat
          label="Active roles indexed"
          value={metrics ? metrics.jobs.active.toLocaleString() : loading ? "..." : "0"}
          hint={metrics ? `${metrics.jobs.total.toLocaleString()} total roles ingested` : "Live catalog status"}
        />
        <Stat
          label="Ingested (24h)"
          value={metrics ? metrics.ingestion.recordsCreatedLast24h.toLocaleString() : loading ? "..." : "0"}
          hint={metrics ? `${metrics.ingestion.runsLast24h} runs (${metrics.ingestion.failedRunsLast24h} failed)` : "Last 24h ingestion"}
        />
        <Stat
          label="Failed records (24h)"
          value={metrics ? metrics.ingestion.failedRunsLast24h.toLocaleString() : loading ? "..." : "0"}
          hint={metrics ? `${metrics.pipelines.outboxFailed} outbox failures` : "Zero failures desired"}
          tone={metrics && metrics.ingestion.failedRunsLast24h > 0 ? "text-red" : "text-slate"}
        />
        <Stat
          label="Users active"
          value={metrics ? `${metrics.users.active} / ${metrics.users.total}` : loading ? "..." : "0"}
          hint={metrics ? `${metrics.pipelines.alertsActive} active alerts` : "Registered accounts"}
          tone="text-ink"
        />
      </div>

      <div className="grid lg:grid-cols-[1fr_320px] gap-8 items-start">
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold text-ink inline-flex items-center gap-2"><Activity size={18} className="text-indigo" /> Provider health</h2>
            <Link to="/admin/sources" className="text-[13px] text-indigo font-medium inline-flex items-center gap-1">Manage sources <ArrowRight size={14} /></Link>
          </div>
          <div className="rounded-[var(--radius-card)] border border-line overflow-hidden">
            <div className="hidden md:grid grid-cols-[1.6fr_0.9fr_1fr_0.7fr_0.7fr] gap-4 px-5 py-3 bg-soft text-[12px] font-semibold text-slate uppercase tracking-wide">
              <span>Source</span><span>Status</span><span>Last sync</span><span>Ingested</span><span>Failed</span>
            </div>
            {loading && sources.length === 0 ? (
              <div className="px-5 py-5 text-sm text-slate">Loading providers...</div>
            ) : sources.map((p) => {
              const m = statusMeta[p.status];
              return (
                <div key={p.id} className="grid md:grid-cols-[1.6fr_0.9fr_1fr_0.7fr_0.7fr] gap-2 md:gap-4 px-5 py-4 border-t border-line items-center">
                  <span className="font-medium text-ink inline-flex items-center gap-2"><Database size={15} className="text-slate" /> {p.name}</span>
                  <span><Badge tone={m.tone}>{m.icon} {m.label}</Badge></span>
                  <span className="font-data text-[13px] text-slate">{p.lastRun ? relativeTime(p.lastRun.startedAt) : "No syncs yet"}</span>
                  <span className="font-data text-[13px] text-ink">{p.stats24h.recordsCreated.toLocaleString()}</span>
                  <span className={`font-data text-[13px] ${p.stats24h.failures > 0 ? "text-red" : "text-slate"}`}>{p.stats24h.failures}</span>
                </div>
              );
            })}
          </div>
          <div className="mt-8 flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold text-ink inline-flex items-center gap-2"><ShieldAlert size={18} className="text-indigo" /> Users</h2>
          </div>
          <div className="rounded-[var(--radius-card)] border border-line overflow-hidden">
            <div className="hidden md:grid grid-cols-[1.7fr_0.7fr_1fr_1.1fr_1fr] gap-4 px-5 py-3 bg-soft text-[12px] font-semibold text-slate uppercase tracking-wide">
              <span>Email</span><span>Role</span><span>Status</span><span>Verified</span><span>Created</span>
            </div>
            {loading && users.length === 0 ? (
              <div className="px-5 py-5 text-sm text-slate">Loading users...</div>
            ) : error ? (
              <div className="px-5 py-5 text-sm text-red">{error}</div>
            ) : users.length === 0 ? (
              <div className="px-5 py-5 text-sm text-slate">No users found.</div>
            ) : users.map((u) => (
              <div key={u.id} className="grid md:grid-cols-[1.7fr_0.7fr_1fr_1.1fr_1fr] gap-2 md:gap-4 px-5 py-4 border-t border-line items-center">
                <span className="font-medium text-ink">{u.email}</span>
                <select className="rounded-[var(--radius-control)] border border-line bg-white text-sm px-2 h-9" value={u.role} onChange={(e) => void updateRole(u, e.target.value as AuthRole)}>
                  <option value="USER">USER</option>
                  <option value="ADMIN">ADMIN</option>
                </select>
                <select className="rounded-[var(--radius-control)] border border-line bg-white text-sm px-2 h-9" value={u.status} onChange={(e) => void updateStatus(u, e.target.value as AuthStatus)}>
                  <option value="PENDING_VERIFICATION">Pending</option>
                  <option value="ACTIVE">Active</option>
                  <option value="LOCKED">Locked</option>
                  <option value="DISABLED">Disabled</option>
                </select>
                <span className="font-data text-[13px] text-slate">{u.emailVerifiedAt ? relativeTime(u.emailVerifiedAt) : "Not verified"}</span>
                <span className="font-data text-[13px] text-slate">{relativeTime(u.createdAt)}</span>
              </div>
            ))}
          </div>
        </section>

        <aside className="space-y-4">
          <div className="rounded-[var(--radius-card)] border border-amber/30 bg-amber-tint/50 p-4">
            <div className="flex items-center gap-2 text-ink font-semibold text-sm"><AlertTriangle size={16} className="text-amber" /> Needs attention</div>
            <ul className="mt-2 space-y-2 text-[13px] text-ink/90">
              {metrics && (metrics.jobs.suspicious > 0 || metrics.jobs.flagged > 0 || metrics.pipelines.outboxFailed > 0) ? (
                <>
                  {metrics.jobs.suspicious > 0 && (
                    <li><b>{metrics.jobs.suspicious}</b> suspicious listings detected.</li>
                  )}
                  {metrics.jobs.flagged > 0 && (
                    <li><b>{metrics.jobs.flagged}</b> flagged jobs need review.</li>
                  )}
                  {metrics.pipelines.outboxFailed > 0 && (
                    <li><b>{metrics.pipelines.outboxFailed}</b> failed outbox events.</li>
                  )}
                </>
              ) : (
                <li>All ingestion and moderation pipelines healthy.</li>
              )}
            </ul>
            <Button variant="secondary" size="sm" className="mt-3" asChild>
              <Link to="/admin/moderation">View moderation queue</Link>
            </Button>
          </div>

          <div className="rounded-[var(--radius-card)] border border-line p-4">
            <Kicker className="mb-2">Moderation queue</Kicker>
            <p className="font-data text-2xl text-ink">
              {metrics ? (metrics.jobs.suspicious + metrics.jobs.flagged + metrics.jobs.stale + metrics.jobs.expired).toLocaleString() : "0"}
            </p>
            <p className="text-[12px] text-slate">
              {metrics ? `${metrics.jobs.suspicious} suspicious, ${metrics.jobs.stale} stale` : "Live queue count"}
            </p>
            <SectionRule className="my-3" />
            <Link to="/admin/moderation" className="text-[13px] text-indigo font-medium inline-flex items-center gap-1">Open moderation <ArrowRight size={14} /></Link>
          </div>

          <div className="rounded-[var(--radius-card)] border border-line p-4">
            <Kicker className="mb-2">Coverage</Kicker>
            <p className="text-[13px] text-slate">{companies.length} companies actively tracked · Pakistan, UAE, worldwide-remote.</p>
            <p className="text-[12px] text-slate mt-2 inline-flex items-center gap-1"><Layers size={12} /> 9 disciplines mapped</p>
          </div>
        </aside>
      </div>
    </PageContainer>
  );
}
