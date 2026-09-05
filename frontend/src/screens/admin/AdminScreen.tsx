import { Link } from "react-router";
import { Activity, AlertTriangle, CheckCircle2, Database, RefreshCw, ShieldAlert, Layers, ArrowRight } from "lucide-react";
import { PageContainer, PageHeader } from "../../components/shell/AppShell";
import { Kicker, Badge, Button, SectionRule } from "../../components/ui/primitives";
import { companies } from "../../lib/fixtures";
import { relativeTime } from "../../lib/format";

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
  return (
    <PageContainer>
      <PageHeader
        kicker="Operations · internal"
        title="System health & ingestion."
        description="Provider status, ingestion volume and data quality across the pipeline. Desktop-first operational view."
        actions={<Button variant="secondary" icon={<RefreshCw size={16} />}>Refresh now</Button>}
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <Stat label="Active roles indexed" value="Unavailable" hint="Admin metrics API not connected" tone="text-slate" />
        <Stat label="Ingested (24h)" value="Unavailable" hint="No live admin metric yet" />
        <Stat label="Failed records (24h)" value="Unavailable" hint="No live admin metric yet" tone="text-slate" />
        <Stat label="Duplicate rate" value="Unavailable" hint="No live admin metric yet" tone="text-slate" />
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
            {providers.map((p) => {
              const m = statusMeta[p.status];
              return (
                <div key={p.name} className="grid md:grid-cols-[1.6fr_0.9fr_1fr_0.7fr_0.7fr] gap-2 md:gap-4 px-5 py-4 border-t border-line items-center">
                  <span className="font-medium text-ink inline-flex items-center gap-2"><Database size={15} className="text-slate" /> {p.name}</span>
                  <span><Badge tone={m.tone}>{m.icon} {m.label}</Badge></span>
                  <span className="font-data text-[13px] text-slate">{relativeTime(p.lastSync)}</span>
                  <span className="font-data text-[13px] text-ink">{p.ingested.toLocaleString()}</span>
                  <span className={`font-data text-[13px] ${p.failed > 20 ? "text-red" : "text-slate"}`}>{p.failed}</span>
                </div>
              );
            })}
          </div>
        </section>

        <aside className="space-y-4">
          <div className="rounded-[var(--radius-card)] border border-amber/30 bg-amber-tint/50 p-4">
            <div className="flex items-center gap-2 text-ink font-semibold text-sm"><AlertTriangle size={16} className="text-amber" /> Needs attention</div>
            <ul className="mt-2 space-y-2 text-[13px] text-ink/90">
              <li>No live admin incident feed is connected yet.</li>
            </ul>
            <Button variant="secondary" size="sm" className="mt-3">View incident log</Button>
          </div>

          <div className="rounded-[var(--radius-card)] border border-line p-4">
            <Kicker className="mb-2">Moderation queue</Kicker>
            <p className="font-data text-2xl text-ink">0</p>
            <p className="text-[12px] text-slate">Moderation API not connected</p>
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
