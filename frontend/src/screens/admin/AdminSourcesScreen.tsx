import { useState } from "react";
import { Link } from "react-router";
import { ArrowLeft, Plus, RefreshCw, CheckCircle2, AlertTriangle, ShieldAlert, Settings2 } from "lucide-react";
import { PageContainer, PageHeader } from "../../components/shell/AppShell";
import { Badge, Button } from "../../components/ui/primitives";
import { Switch } from "../../components/ui/form";
import { useToast } from "../../components/ui/toast";
import { relativeTime } from "../../lib/format";

type Source = {
  id: string;
  name: string;
  kind: string;
  region: string;
  status: "healthy" | "degraded" | "down";
  lastSync: string;
  dedupe: number;
  enabled: boolean;
};

const seed: Source[] = [
  { id: "linkedin", name: "LinkedIn Jobs API", kind: "API", region: "Global", status: "healthy", lastSync: "2026-09-02T07:40:00Z", dedupe: 4.1, enabled: true },
  { id: "indeed", name: "Indeed Feed", kind: "XML feed", region: "Global", status: "healthy", lastSync: "2026-09-02T07:12:00Z", dedupe: 5.8, enabled: true },
  { id: "rozee", name: "Rozee.pk Scraper", kind: "Scraper", region: "Pakistan", status: "degraded", lastSync: "2026-09-02T05:02:00Z", dedupe: 9.2, enabled: true },
  { id: "bayt", name: "Bayt.com Feed", kind: "XML feed", region: "UAE", status: "healthy", lastSync: "2026-09-02T06:55:00Z", dedupe: 6.0, enabled: true },
  { id: "careers", name: "Company careers crawler", kind: "Crawler", region: "Global", status: "down", lastSync: "2026-09-01T22:10:00Z", dedupe: 3.3, enabled: false },
];

const statusMeta = {
  healthy: { tone: "emerald" as const, icon: <CheckCircle2 size={13} />, label: "Healthy" },
  degraded: { tone: "amber" as const, icon: <AlertTriangle size={13} />, label: "Degraded" },
  down: { tone: "red" as const, icon: <ShieldAlert size={13} />, label: "Down" },
};

export function Component() {
  const toast = useToast();
  const [sources, setSources] = useState(seed);

  function toggle(id: string) {
    setSources((prev) => prev.map((s) => (s.id === id ? { ...s, enabled: !s.enabled } : s)));
    const s = sources.find((x) => x.id === id);
    toast({ kind: "info", message: `${s?.name} ${s?.enabled ? "disabled" : "enabled"}.` });
  }

  return (
    <PageContainer>
      <Link to="/admin" className="text-[13px] text-slate hover:text-ink inline-flex items-center gap-1 mb-4"><ArrowLeft size={14} /> System health</Link>
      <PageHeader
        kicker="Operations · sources"
        title="Ingestion sources."
        description="Enable, disable and monitor every data source feeding the index."
        actions={<Button icon={<Plus size={16} />} onClick={() => toast({ kind: "success", message: "Source form — coming next." })}>Add source</Button>}
      />

      <div className="space-y-3">
        {sources.map((s) => {
          const m = statusMeta[s.status];
          return (
            <div key={s.id} className="rounded-[var(--radius-card)] border border-line p-5 flex flex-wrap items-center gap-4">
              <div className="grow min-w-[220px]">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-ink">{s.name}</h3>
                  <Badge tone={m.tone}>{m.icon} {m.label}</Badge>
                  {!s.enabled && <Badge tone="slate">Disabled</Badge>}
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-x-5 gap-y-1 text-[12px] text-slate font-data">
                  <span>{s.kind}</span>
                  <span>{s.region}</span>
                  <span>Last sync {relativeTime(s.lastSync)}</span>
                  <span>Duplicate rate {s.dedupe}%</span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="tertiary" size="sm" icon={<RefreshCw size={14} />} onClick={() => toast({ kind: "info", message: `Re-syncing ${s.name}…` })}>Sync</Button>
                <Button variant="tertiary" size="sm" icon={<Settings2 size={14} />}>Configure</Button>
                <div className="pl-2 border-l border-line">
                  <Switch label="" checked={s.enabled} onChange={() => toggle(s.id)} />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </PageContainer>
  );
}
