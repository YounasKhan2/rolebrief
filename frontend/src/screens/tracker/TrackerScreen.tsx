import { useState } from "react";
import { Link } from "react-router";
import { Plus, Bell, ExternalLink, LayoutList, Columns3, CalendarClock, StickyNote } from "lucide-react";
import { PageContainer, PageHeader } from "../../components/shell/AppShell";
import { Kicker, Badge, Button, CompanyLogo, EmptyState } from "../../components/ui/primitives";
import { SegmentedControl } from "../../components/ui/form";
import { trackerItems, getJob, companyName } from "../../lib/fixtures";
import type { TrackerStatus } from "../../lib/fixtures";
import { formatDate, relativeTime } from "../../lib/format";
import { useToast } from "../../components/ui/toast";

const statuses: TrackerStatus[] = ["Saved", "Applied", "Interview", "Offer", "Rejected", "Withdrawn"];
const statusTone: Record<TrackerStatus, "slate" | "indigo" | "cyan" | "emerald" | "red"> = {
  Saved: "slate",
  Applied: "indigo",
  Interview: "cyan",
  Offer: "emerald",
  Rejected: "red",
  Withdrawn: "slate",
};

export function Component() {
  const toast = useToast();
  const [view, setView] = useState<"list" | "board">("list");

  if (trackerItems.length === 0) {
    return (
      <PageContainer>
        <PageHeader kicker="Application tracker" title="Track every application." />
        <EmptyState icon={<LayoutList size={40} />} title="Nothing tracked yet" body="Save or apply to a role and it will appear here with its status and next action." action={<Link to="/jobs" className="text-indigo font-medium">Find roles</Link>} />
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <PageHeader
        kicker="Application tracker"
        title="Every application, one clear view."
        description="Status, next action and history — not a busy Kanban unless you want one."
        actions={
          <div className="flex items-center gap-2">
            <SegmentedControl value={view} onChange={setView} size="sm" options={[{ value: "list", label: "List" }, { value: "board", label: "Board" }]} />
            <Button icon={<Plus size={16} />} onClick={() => toast({ kind: "success", message: "Add a role manually — coming from the form." })}>Add</Button>
          </div>
        }
      />

      {view === "list" ? (
        <div className="rounded-[var(--radius-card)] border border-line overflow-hidden">
          {/* Desktop table header */}
          <div className="hidden md:grid grid-cols-[1.6fr_0.8fr_1fr_1.2fr_auto] gap-4 px-5 py-3 bg-soft text-[12px] font-semibold text-slate uppercase tracking-wide">
            <span>Role</span><span>Status</span><span>Source</span><span>Next action</span><span></span>
          </div>
          {trackerItems.map((t) => {
            const job = getJob(t.jobSlug);
            if (!job) return null;
            return (
              <div key={t.id} className="grid md:grid-cols-[1.6fr_0.8fr_1fr_1.2fr_auto] gap-2 md:gap-4 px-5 py-4 border-t border-line items-center hover:bg-soft/50">
                <div className="flex items-center gap-3 min-w-0">
                  <CompanyLogo name={companyName(job.companySlug)} size={36} />
                  <div className="min-w-0">
                    <Link to={`/jobs/${job.slug}`} className="font-medium text-ink hover:text-indigo block truncate">{job.title}</Link>
                    <p className="text-[12px] text-slate truncate">{companyName(job.companySlug)} · updated {relativeTime(t.updatedAt)}</p>
                  </div>
                </div>
                <div><Badge tone={statusTone[t.status]}>{t.status}</Badge></div>
                <div className="text-[13px] text-slate font-data truncate">{t.source}{t.resumeVersion && <span className="block text-[11px]">{t.resumeVersion}</span>}</div>
                <div className="text-[13px] text-ink">
                  {t.nextAction ?? "—"}
                  {t.reminderAt && (
                    <span className="mt-1 flex items-center gap-1 text-[12px] text-amber"><CalendarClock size={12} /> {formatDate(t.reminderAt)}</span>
                  )}
                </div>
                <div className="flex items-center gap-1 justify-end">
                  <Button variant="tertiary" size="sm" icon={<Bell size={14} />} onClick={() => toast({ kind: "success", message: "Reminder scheduled." })}>Remind</Button>
                  <a href={job.applyUrl} target="_blank" rel="noreferrer" className="inline-flex items-center justify-center size-9 rounded-[var(--radius-control)] text-slate hover:bg-soft hover:text-ink"><ExternalLink size={15} /></a>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        // Board view
        <div className="grid grid-flow-col auto-cols-[minmax(240px,1fr)] gap-4 overflow-x-auto scrollbar-thin pb-2">
          {statuses.map((s) => {
            const items = trackerItems.filter((t) => t.status === s);
            return (
              <div key={s} className="rounded-[var(--radius-card)] bg-soft/70 p-3">
                <div className="flex items-center justify-between px-1 mb-3">
                  <span className="inline-flex items-center gap-2 text-[13px] font-semibold text-ink"><Badge tone={statusTone[s]}>{s}</Badge></span>
                  <span className="font-data text-[12px] text-slate">{items.length}</span>
                </div>
                <div className="space-y-2.5">
                  {items.map((t) => {
                    const job = getJob(t.jobSlug);
                    if (!job) return null;
                    return (
                      <div key={t.id} className="rounded-[10px] border border-line bg-white p-3">
                        <Link to={`/jobs/${job.slug}`} className="text-[13px] font-medium text-ink hover:text-indigo block leading-snug">{job.title}</Link>
                        <p className="text-[12px] text-slate mt-0.5">{companyName(job.companySlug)}</p>
                        {t.nextAction && <p className="text-[12px] text-slate mt-2 flex items-start gap-1"><StickyNote size={11} className="mt-0.5" /> {t.nextAction}</p>}
                      </div>
                    );
                  })}
                  {items.length === 0 && <p className="text-[12px] text-slate px-1 py-2">Empty</p>}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Status history for the active application */}
      <div className="mt-8 rounded-[var(--radius-card)] border border-line p-5">
        <Kicker className="mb-4">Status history · {getJob(trackerItems[0].jobSlug)?.title}</Kicker>
        <ol className="relative pl-5">
          <span className="absolute left-[7px] top-1 bottom-1 w-px bg-line" aria-hidden />
          {trackerItems[0].history.map((h, i) => (
            <li key={i} className="relative pb-3 last:pb-0">
              <span className="absolute -left-5 top-0.5 size-3 rounded-full bg-white border-2 border-indigo" />
              <div className="flex items-baseline justify-between gap-3">
                <Badge tone={statusTone[h.status]}>{h.status}</Badge>
                <span className="font-data text-[12px] text-slate">{formatDate(h.at)}</span>
              </div>
            </li>
          ))}
        </ol>
        {trackerItems[0].notes && (
          <p className="mt-3 text-[13px] text-slate flex items-start gap-1.5"><StickyNote size={13} className="mt-0.5" /> {trackerItems[0].notes}</p>
        )}
      </div>
    </PageContainer>
  );
}
