import { useState } from "react";
import { Bell, Plus, Pause, Play, Copy, Trash2, Pencil, X, Check, ArrowRight, Sparkles } from "lucide-react";
import { PageContainer, PageHeader } from "../../components/shell/AppShell";
import { Kicker, Badge, Button, FilterChip, EmptyState } from "../../components/ui/primitives";
import { Input, SegmentedControl, Checkbox } from "../../components/ui/form";
import { Sheet } from "../../components/ui/overlay";
import { JobCard } from "../../components/rolebrief/JobCard";
import { alerts as seedAlerts, jobs } from "../../lib/fixtures";
import type { Alert } from "../../lib/fixtures";
import { relativeTime } from "../../lib/format";
import { useToast } from "../../components/ui/toast";

export function Component() {
  const toast = useToast();
  const [alerts, setAlerts] = useState<Alert[]>(seedAlerts);
  const [builderOpen, setBuilderOpen] = useState(false);

  function update(id: string, patch: Partial<Alert>) {
    setAlerts((prev) => prev.map((a) => (a.id === id ? { ...a, ...patch } : a)));
  }

  return (
    <PageContainer>
      <PageHeader
        kicker="Smart Alerts"
        title="Roles that find you."
        description="Describe what you want in plain language. We parse it into editable filters and watch for fresh matches."
        actions={<Button icon={<Plus size={16} />} onClick={() => setBuilderOpen(true)}>New alert</Button>}
      />

      {alerts.length === 0 ? (
        <EmptyState icon={<Bell size={40} />} title="No alerts yet" body="Create your first alert to get fresh matches without checking back." action={<Button onClick={() => setBuilderOpen(true)}>Create an alert</Button>} />
      ) : (
        <div className="space-y-4">
          {alerts.map((a) => (
            <div key={a.id} className="rounded-[var(--radius-card)] border border-line p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <Bell size={16} className="text-indigo" />
                    <h3 className="font-semibold text-ink">{a.name}</h3>
                    <Badge tone={a.status === "Active" ? "emerald" : "amber"}>{a.status}</Badge>
                  </div>
                  <div className="mt-2.5 flex flex-wrap gap-1.5">
                    {a.chips.map((c) => <Badge key={c} tone="slate">{c}</Badge>)}
                  </div>
                </div>
                <div className="flex items-center gap-0.5 text-slate">
                  <Button variant="tertiary" size="sm" icon={a.status === "Active" ? <Pause size={14} /> : <Play size={14} />} onClick={() => update(a.id, { status: a.status === "Active" ? "Paused" : "Active" })}>
                    {a.status === "Active" ? "Pause" : "Resume"}
                  </Button>
                  <Button variant="tertiary" size="sm" icon={<Pencil size={14} />}>Edit</Button>
                  <Button variant="tertiary" size="sm" icon={<Copy size={14} />} onClick={() => toast({ kind: "success", message: "Alert duplicated." })}>Duplicate</Button>
                  <Button variant="tertiary" size="sm" icon={<Trash2 size={14} />} onClick={() => { setAlerts((p) => p.filter((x) => x.id !== a.id)); toast({ kind: "info", message: "Alert deleted." }); }}>Delete</Button>
                </div>
              </div>
              <div className="mt-4 pt-3 border-t border-line flex flex-wrap items-center gap-x-6 gap-y-1 text-[13px] text-slate font-data">
                <span>{a.cadence}</span>
                <span>{a.channels.join(" · ")}</span>
                <span>Volume {a.volume}</span>
                {a.lastSent && <span>Last sent {relativeTime(a.lastSent)}</span>}
              </div>
            </div>
          ))}
        </div>
      )}

      <AlertBuilder
        open={builderOpen}
        onClose={() => setBuilderOpen(false)}
        onCreate={(a) => { setAlerts((p) => [a, ...p]); toast({ kind: "success", message: "Alert created." }); }}
      />
    </PageContainer>
  );
}

function AlertBuilder({ open, onClose, onCreate }: { open: boolean; onClose: () => void; onCreate: (a: Alert) => void }) {
  const [nl, setNl] = useState("Senior React roles, worldwide remote, employer-provided salary");
  const [chips, setChips] = useState<string[]>(["Frontend", "React", "Worldwide remote", "Senior", "Employer-provided salary"]);
  const [cadence, setCadence] = useState<Alert["cadence"]>("Daily");
  const [inApp, setInApp] = useState(true);
  const [email, setEmail] = useState(true);
  const [quiet, setQuiet] = useState(true);
  const preview = jobs.filter((j) => j.eligibility.state === "eligible").slice(0, 3);

  function parse() {
    // Prototype "parse": derive a couple of chips from keywords.
    const found: string[] = [];
    const t = nl.toLowerCase();
    if (t.includes("react")) found.push("React");
    if (t.includes("remote")) found.push("Worldwide remote");
    if (t.includes("senior")) found.push("Senior");
    if (t.includes("salary")) found.push("Employer-provided salary");
    if (t.includes("backend")) found.push("Backend");
    setChips(found.length ? Array.from(new Set(["Frontend", ...found])) : chips);
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Alert Builder"
      side="right"
      footer={
        <>
          <Button variant="secondary" className="grow" onClick={onClose}>Cancel</Button>
          <Button
            className="grow"
            icon={<Check size={16} />}
            onClick={() => {
              onCreate({ id: `a${Date.now()}`, name: chips.slice(0, 2).join(" · ") || "New alert", chips, cadence, channels: [...(inApp ? ["In-app" as const] : []), ...(email ? ["Email" as const] : [])], status: "Active", volume: "~5 / week" });
              onClose();
            }}
          >
            Confirm alert
          </Button>
        </>
      }
    >
      <div className="space-y-6">
        <div>
          <Kicker className="mb-2">1 · Describe it</Kicker>
          <Input aria-label="Describe your alert" value={nl} onChange={(e) => setNl(e.target.value)} />
          <Button variant="tertiary" size="sm" className="mt-2" icon={<Sparkles size={14} />} onClick={parse}>Parse into filters</Button>
        </div>

        <div>
          <Kicker className="mb-2">2 · Refine filters</Kicker>
          <div className="flex flex-wrap gap-2">
            {chips.map((c) => (
              <span key={c} className="inline-flex items-center gap-1 h-8 pl-3 pr-1.5 rounded-full bg-indigo-tint text-navy text-[13px] font-medium">
                {c}
                <button aria-label={`Remove ${c}`} onClick={() => setChips((p) => p.filter((x) => x !== c))} className="inline-flex items-center justify-center size-5 rounded-full hover:bg-white/60">
                  <X size={12} />
                </button>
              </span>
            ))}
            <FilterChip onClick={() => setChips((p) => [...p, "Full-time"])}>+ Add filter</FilterChip>
          </div>
        </div>

        <div>
          <Kicker className="mb-2">3 · Preview matches</Kicker>
          <p className="text-[13px] text-slate mb-3">Three representative roles · expected volume <span className="font-data text-ink">~5 / week</span></p>
          <div className="space-y-3">
            {preview.map((j) => <JobCard key={j.slug} job={j} variant="compact" />)}
          </div>
        </div>

        <div>
          <Kicker className="mb-2">4 · Delivery</Kicker>
          <div className="space-y-3">
            <SegmentedControl value={cadence} onChange={(v) => setCadence(v as Alert["cadence"])} options={["Instant", "Daily", "Weekly"].map((v) => ({ value: v, label: v }))} />
            <div className="rounded-[var(--radius-card)] border border-line p-4 space-y-1">
              <Checkbox label="In-app notifications" checked={inApp} onChange={setInApp} />
              <Checkbox label="Email digest" checked={email} onChange={setEmail} />
              <Checkbox label="Respect quiet hours (10pm–8am)" checked={quiet} onChange={setQuiet} />
            </div>
          </div>
        </div>
      </div>
    </Sheet>
  );
}
