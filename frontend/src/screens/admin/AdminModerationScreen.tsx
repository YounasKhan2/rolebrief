import { useState } from "react";
import { Link } from "react-router";
import { ArrowLeft, Flag, ShieldAlert, Copy, Check, X, ExternalLink, MapPin } from "lucide-react";
import { PageContainer, PageHeader } from "../../components/shell/AppShell";
import { Kicker, Badge, Button, CompanyLogo, EmptyState } from "../../components/ui/primitives";
import { Tabs } from "../../components/ui/form";
import { useToast } from "../../components/ui/toast";
import { relativeTime } from "../../lib/format";

type Tab = "reports" | "suspicious" | "duplicates";

type QueueItem = {
  id: string;
  title: string;
  company: string;
  location: string;
  reason: string;
  detail: string;
  reportedAt: string;
  severity: "high" | "medium";
};

const reports: QueueItem[] = [];

const suspicious: QueueItem[] = [];

const duplicates: Array<{ id: string; title: string; company: string; sources: string[]; location: string; firstSeen: string }> = [];

export function Component() {
  const toast = useToast();
  const [tab, setTab] = useState<Tab>("reports");
  const [resolved, setResolved] = useState<Set<string>>(new Set());

  function resolve(id: string, action: string) {
    setResolved((p) => new Set(p).add(id));
    toast({ kind: "success", message: `${action}.` });
  }

  const activeReports = reports.filter((r) => !resolved.has(r.id));
  const activeSuspicious = suspicious.filter((r) => !resolved.has(r.id));
  const activeDupes = duplicates.filter((r) => !resolved.has(r.id));

  return (
    <PageContainer className="max-w-[980px]">
      <Link to="/admin" className="text-[13px] text-slate hover:text-ink inline-flex items-center gap-1 mb-4"><ArrowLeft size={14} /> System health</Link>
      <PageHeader kicker="Operations · moderation" title="Keep the index trustworthy." description="Review user reports, suspected fraudulent listings and duplicate roles. Actions are logged." />

      <div className="mb-6">
        <Tabs
          value={tab}
          onChange={setTab}
          tabs={[
            { value: "reports", label: "User reports", count: activeReports.length },
            { value: "suspicious", label: "Suspicious", count: activeSuspicious.length },
            { value: "duplicates", label: "Duplicates", count: activeDupes.length },
          ]}
        />
      </div>

      {tab === "reports" && (
        activeReports.length === 0 ? (
          <EmptyState icon={<Check size={40} />} title="Queue clear" body="No open user reports right now." />
        ) : (
          <div className="space-y-4">
            {activeReports.map((r) => <ModerationCard key={r.id} item={r} icon={<Flag size={16} className="text-amber" />} onResolve={resolve} />)}
          </div>
        )
      )}

      {tab === "suspicious" && (
        activeSuspicious.length === 0 ? (
          <EmptyState icon={<Check size={40} />} title="Nothing flagged" body="No suspected fraudulent listings." />
        ) : (
          <div className="space-y-4">
            {activeSuspicious.map((r) => <ModerationCard key={r.id} item={r} icon={<ShieldAlert size={16} className="text-red" />} onResolve={resolve} />)}
          </div>
        )
      )}

      {tab === "duplicates" && (
        activeDupes.length === 0 ? (
          <EmptyState icon={<Check size={40} />} title="No duplicates" body="Dedupe is keeping the index clean." />
        ) : (
          <div className="space-y-4">
            {activeDupes.map((d) => (
              <div key={d.id} className="rounded-[var(--radius-card)] border border-line p-5">
                <div className="flex items-start gap-3">
                  <CompanyLogo name={d.company} size={40} />
                  <div className="grow">
                    <div className="flex items-center gap-2">
                      <Copy size={15} className="text-slate" />
                      <h3 className="font-semibold text-ink">{d.title}</h3>
                    </div>
                    <p className="text-[13px] text-slate">{d.company} · {d.location}</p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {d.sources.map((s) => <Badge key={s} tone="slate">{s}</Badge>)}
                    </div>
                    <p className="text-[12px] text-slate font-data mt-2">First seen {relativeTime(d.firstSeen)} · {d.sources.length} copies</p>
                  </div>
                </div>
                <div className="mt-4 pt-3 border-t border-line flex flex-wrap gap-2">
                  <Button size="sm" onClick={() => resolve(d.id, "Merged into canonical listing")}>Merge duplicates</Button>
                  <Button variant="secondary" size="sm" onClick={() => resolve(d.id, "Marked as distinct")}>Keep separate</Button>
                </div>
              </div>
            ))}
          </div>
        )
      )}
    </PageContainer>
  );
}

function ModerationCard({ item, icon, onResolve }: { item: QueueItem; icon: React.ReactNode; onResolve: (id: string, action: string) => void }) {
  return (
    <div className="rounded-[var(--radius-card)] border border-line p-5">
      <div className="flex items-start gap-3">
        <CompanyLogo name={item.company} size={40} />
        <div className="grow min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-semibold text-ink">{item.title}</h3>
            <Badge tone={item.severity === "high" ? "red" : "amber"}>{icon} {item.reason}</Badge>
          </div>
          <p className="text-[13px] text-slate">{item.company}</p>
          <p className="text-[12px] text-slate inline-flex items-center gap-1 mt-0.5"><MapPin size={12} /> {item.location} · reported {relativeTime(item.reportedAt)}</p>
          <p className="mt-3 text-sm text-ink/90 rounded-[10px] bg-soft p-3">{item.detail}</p>
        </div>
      </div>
      <div className="mt-4 pt-3 border-t border-line flex flex-wrap items-center gap-2">
        <Button variant="destructive" size="sm" icon={<X size={14} />} onClick={() => onResolve(item.id, "Listing removed")}>Remove listing</Button>
        <Button variant="secondary" size="sm" icon={<ShieldAlert size={14} />} onClick={() => onResolve(item.id, "Poster flagged for review")}>Flag poster</Button>
        <Button variant="tertiary" size="sm" icon={<Check size={14} />} onClick={() => onResolve(item.id, "Dismissed — listing is legitimate")}>Dismiss</Button>
        <a href="#" className="ml-auto text-[13px] text-slate hover:text-ink inline-flex items-center gap-1">View listing <ExternalLink size={13} /></a>
      </div>
    </div>
  );
}
