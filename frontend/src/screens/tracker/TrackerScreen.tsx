import { useEffect, useState, useCallback } from "react";
import { Link } from "react-router";
import {
  Plus,
  ExternalLink,
  LayoutList,
  Columns3,
  CalendarClock,
  Clock,
  Sparkles,
  MoreHorizontal,
  ChevronRight,
  Building2
} from "lucide-react";
import { PageContainer, PageHeader } from "../../components/shell/AppShell";
import { Badge, Button, EmptyState } from "../../components/ui/primitives";
import { SegmentedControl } from "../../components/ui/form";
import { relativeTime } from "../../lib/format";
import { useTracker } from "../../lib/tracker-context";
import {
  ApplicationStage,
  TrackedApplication
} from "../../lib/tracker-api";
import { AddApplicationDialog } from "../../components/tracker/AddApplicationDialog";
import {
  ApplicationDetailDialog,
  ALLOWED_TRANSITIONS,
  STAGE_LABELS,
  STAGE_TONES
} from "../../components/tracker/ApplicationDetailDialog";

const STAGES: ApplicationStage[] = [
  "SAVED",
  "APPLIED",
  "INTERVIEWING",
  "OFFER",
  "REJECTED",
  "WITHDRAWN"
];

export function Component() {
  const {
    applications,
    stageCounts,
    totalCount,
    lifecycleFilter,
    setLifecycleFilter,
    stageFilter,
    setStageFilter,
    loadMore,
    hasNextPage,
    isLoadingMore,
    isLoading,
    updateStage,
    isPending,
    refreshTracker
  } = useTracker();

  const [view, setView] = useState<"board" | "list">("board");

  const [isAddOpen, setIsAddOpen] = useState(false);
  const [selectedApplication, setSelectedApplication] = useState<TrackedApplication | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);

  const handleStageSelect = async (
    app: TrackedApplication,
    newStage: ApplicationStage
  ) => {
    if (newStage === app.stage) return;
    const updated = await updateStage(app.id, newStage, app.revision);
    if (updated && selectedApplication?.id === updated.id) {
      setSelectedApplication(updated);
    }
  };

  const handleDrop = async (e: React.DragEvent, targetStage: ApplicationStage) => {
    e.preventDefault();
    const id = e.dataTransfer.getData("text/plain");
    if (!id) return;
    const app = applications.find((a) => a.id === id);
    if (!app || app.stage === targetStage) return;

    const allowed = ALLOWED_TRANSITIONS[app.stage];
    if (!allowed?.includes(targetStage)) {
      return;
    }

    await handleStageSelect(app, targetStage);
  };

  const totalTracked = Object.values(stageCounts).reduce((a, b) => a + b, 0);

  return (
    <PageContainer>
      <PageHeader
        kicker="Application tracker"
        title="Every application, one clear view."
        description="Status, next action and history with accessible keyboard navigation and drag-and-drop."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <SegmentedControl
              value={lifecycleFilter}
              onChange={(val) => setLifecycleFilter(val as "ACTIVE" | "ARCHIVED")}
              size="sm"
              options={[
                { value: "ACTIVE", label: "Active" },
                { value: "ARCHIVED", label: "Archived" }
              ]}
            />
            <SegmentedControl
              value={view}
              onChange={setView}
              size="sm"
              options={[
                { value: "board", label: "Board" },
                { value: "list", label: "List" }
              ]}
            />
            <Button
              icon={<Plus size={16} />}
              onClick={() => setIsAddOpen(true)}
              className="min-h-[44px]"
            >
              Add Role
            </Button>
          </div>
        }
      />

      {lifecycleFilter === "ARCHIVED" && applications.length === 0 && !isLoading ? (
        <EmptyState
          icon={<LayoutList size={40} />}
          title="No archived applications"
          body="Applications you archive will be stored here safely without cluttering your active pipeline."
          action={
            <Button variant="secondary" onClick={() => setLifecycleFilter("ACTIVE")}>
              View Active Applications
            </Button>
          }
        />
      ) : totalTracked === 0 && lifecycleFilter === "ACTIVE" && !isLoading ? (
        <EmptyState
          icon={<LayoutList size={40} />}
          title="No applications tracked yet"
          body="Track discovered jobs directly or add off-platform applications to keep tabs on every process."
          action={
            <div className="flex gap-3">
              <Link to="/app/jobs">
                <Button variant="primary">Find Roles</Button>
              </Link>
              <Button variant="secondary" onClick={() => setIsAddOpen(true)}>
                Add Manually
              </Button>
            </div>
          }
        />
      ) : (
        <div className="space-y-4">
          {/* Stage Filter Pills (List View Only) */}
          {view === "list" && (
            <div className="flex flex-wrap items-center gap-1.5 pb-1">
              <button
                onClick={() => setStageFilter("ALL")}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                  stageFilter === "ALL"
                    ? "bg-ink text-white"
                    : "bg-soft text-slate hover:text-ink"
                }`}
              >
                All ({lifecycleFilter === "ARCHIVED" ? applications.length : totalTracked})
              </button>
              {STAGES.map((s) => (
                <button
                  key={s}
                  onClick={() => setStageFilter(s)}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors flex items-center gap-1.5 ${
                    stageFilter === s
                      ? "bg-ink text-white"
                      : "bg-soft text-slate hover:text-ink"
                  }`}
                >
                  <span>{STAGE_LABELS[s]}</span>
                  <span className="opacity-70 text-[11px]">({stageCounts[s] || 0})</span>
                </button>
              ))}
            </div>
          )}

          {/* Views */}
          {view === "list" ? (
            <div className="rounded-[var(--radius-card)] border border-line overflow-hidden bg-white">
              {/* Desktop table header */}
              <div className="hidden md:grid grid-cols-[1.8fr_1fr_1fr_1.2fr_auto] gap-4 px-5 py-3 bg-soft text-[12px] font-semibold text-slate uppercase tracking-wide">
                <span>Role & Company</span>
                <span>Stage</span>
                <span>Source</span>
                <span>Next Action</span>
                <span className="text-right">Action</span>
              </div>

              {applications.length === 0 ? (
                <div className="py-12 text-center text-sm text-slate">
                  No applications in this stage.
                </div>
              ) : (
                applications.map((app) => (
                  <div
                    key={app.id}
                    className="grid md:grid-cols-[1.8fr_1fr_1fr_1.2fr_auto] gap-2 md:gap-4 px-5 py-3.5 border-t border-line items-center hover:bg-soft/40 transition-colors"
                  >
                    {/* Role & Company */}
                    <div className="min-w-0">
                      <button
                        onClick={() => {
                          setSelectedApplication(app);
                          setIsDetailOpen(true);
                        }}
                        className="font-semibold text-ink hover:text-indigo text-left block truncate text-sm"
                      >
                        {app.roleTitle}
                      </button>
                      <div className="flex items-center gap-1.5 text-xs text-slate truncate mt-0.5">
                        <Building2 size={13} />
                        <span>{app.companyName || "Direct / Unspecified"}</span>
                        <span>·</span>
                        <span>updated {relativeTime(app.updatedAt)}</span>
                      </div>
                    </div>

                    {/* Stage & Expired Badge */}
                    <div className="flex items-center gap-1.5">
                      <Badge tone={STAGE_TONES[app.stage]}>
                        {STAGE_LABELS[app.stage]}
                      </Badge>
                      {app.isJobExpired && (
                        <Badge tone="red">
                          Expired listing
                        </Badge>
                      )}
                    </div>

                    {/* Source */}
                    <div className="text-xs text-slate truncate">
                      {app.sourceLabel || app.providerName || (app.jobSlug ? "RoleBrief" : "Manual")}
                    </div>

                    {/* Next Action */}
                    <div className="text-xs text-ink min-w-0">
                      {app.nextAction ? (
                        <div className="truncate font-medium">{app.nextAction}</div>
                      ) : (
                        <span className="text-slate/60">—</span>
                      )}
                      {app.nextActionAt && (
                        <span className="mt-0.5 flex items-center gap-1 text-[11px] text-amber">
                          <Clock size={11} />
                          {new Date(app.nextActionAt).toLocaleDateString(undefined, {
                            month: "short",
                            day: "numeric"
                          })}
                        </span>
                      )}
                    </div>

                    {/* Action */}
                    <div className="flex items-center gap-2 justify-end">
                      <Button
                        variant="tertiary"
                        size="sm"
                        onClick={() => {
                          setSelectedApplication(app);
                          setIsDetailOpen(true);
                        }}
                      >
                        Details
                      </Button>
                      {app.applicationUrl && (
                        <a
                          href={app.applicationUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center justify-center size-8 rounded-[var(--radius-control)] text-slate hover:bg-soft hover:text-ink transition-colors"
                          title="Open original listing link"
                        >
                          <ExternalLink size={14} />
                        </a>
                      )}
                    </div>
                  </div>
                ))
              )}
              {hasNextPage && (
                <div className="p-4 border-t border-line flex justify-center bg-white">
                  <Button
                    variant="secondary"
                    onClick={() => void loadMore()}
                    disabled={isLoadingMore}
                    className="min-h-[44px]"
                  >
                    {isLoadingMore ? "Loading more..." : "Load more applications"}
                  </Button>
                </div>
              )}
            </div>
          ) : (
            // Board View (Kanban with Drag-and-Drop AND Accessible Select Dropdown on Every Card)
            <div className="grid grid-flow-col auto-cols-[minmax(270px,1fr)] gap-4 overflow-x-auto scrollbar-thin pb-4 pt-1">
              {STAGES.map((st) => {
                const columnItems = applications.filter((a) => a.stage === st);
                return (
                  <div
                    key={st}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => handleDrop(e, st)}
                    className="rounded-[var(--radius-card)] bg-soft/80 border border-line/70 p-3 min-h-[500px] flex flex-col"
                  >
                    {/* Stage Header */}
                    <div className="flex items-center justify-between px-1 mb-3">
                      <span className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-ink">
                        <Badge tone={STAGE_TONES[st]}>{STAGE_LABELS[st]}</Badge>
                      </span>
                      <span className="font-semibold text-xs text-slate bg-white px-2 py-0.5 rounded-full border border-line">
                        {stageCounts[st] || 0}
                      </span>
                    </div>

                    {/* Cards Container */}
                    <div className="space-y-2.5 flex-1">
                      {columnItems.length === 0 ? (
                        <div className="h-28 border-2 border-dashed border-line/80 rounded-xl flex items-center justify-center text-xs text-slate/60 text-center px-4">
                          Drop here or use card stage selector
                        </div>
                      ) : (
                        columnItems.map((app) => {
                          const validNext = ALLOWED_TRANSITIONS[app.stage] || [];
                          return (
                            <div
                              key={app.id}
                              draggable={true}
                              onDragStart={(e) => e.dataTransfer.setData("text/plain", app.id)}
                              className="rounded-xl border border-line bg-white p-3.5 shadow-sm hover:shadow transition-all cursor-grab active:cursor-grabbing space-y-2.5"
                            >
                              {/* Title & Company */}
                              <div>
                                <button
                                  onClick={() => {
                                    setSelectedApplication(app);
                                    setIsDetailOpen(true);
                                  }}
                                  className="text-sm font-semibold text-ink hover:text-indigo text-left block leading-snug"
                                >
                                  {app.roleTitle}
                                </button>
                                <div className="text-xs text-slate truncate mt-0.5">
                                  {app.companyName || "Direct / Unspecified"}
                                </div>
                              </div>

                              {/* Badges / Expired Warning */}
                              {app.isJobExpired && (
                                <div>
                                  <Badge tone="red">
                                    Expired listing
                                  </Badge>
                                </div>
                              )}

                              {/* Next action chip */}
                              {app.nextAction && (
                                <div className="text-[11px] bg-soft rounded-lg p-1.5 text-ink leading-tight">
                                  <span className="font-semibold text-slate">Next: </span>
                                  {app.nextAction}
                                  {app.nextActionAt && (
                                    <span className="block text-amber font-medium mt-0.5">
                                      Due: {new Date(app.nextActionAt).toLocaleDateString(undefined, {
                                        month: "short",
                                        day: "numeric"
                                      })}
                                    </span>
                                  )}
                                </div>
                              )}

                              {/* Card Footer: Accessible Stage Selector & Detail Button */}
                              <div className="pt-2 border-t border-line/60 flex items-center justify-between gap-1.5">
                                {/* Accessible Stage Selector: Allows keyboard / screen-reader users to move stages */}
                                <select
                                  aria-label={`Move ${app.roleTitle} to stage`}
                                  value={app.stage}
                                  onChange={(e) =>
                                    handleStageSelect(app, e.target.value as ApplicationStage)
                                  }
                                  disabled={isPending(app.id)}
                                  className="text-[11px] font-medium rounded-md border border-line bg-white px-2 py-1.5 min-h-[38px] text-slate hover:text-ink focus:outline-none focus:ring-1 focus:ring-indigo transition-colors max-w-[130px]"
                                >
                                  <option value={app.stage}>
                                    Stage: {STAGE_LABELS[app.stage]}
                                  </option>
                                  {validNext.map((nextSt) => (
                                    <option key={nextSt} value={nextSt}>
                                      → {STAGE_LABELS[nextSt]}
                                    </option>
                                  ))}
                                </select>

                                <button
                                  onClick={() => {
                                    setSelectedApplication(app);
                                    setIsDetailOpen(true);
                                  }}
                                  className="text-[11px] font-semibold text-indigo hover:underline px-2 py-1 min-h-[44px] inline-flex items-center"
                                >
                                  Details
                                </button>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Manual Application Dialog */}
      <AddApplicationDialog
        open={isAddOpen}
        onClose={() => setIsAddOpen(false)}
        onCreated={() => {
          void refreshTracker();
        }}
      />

      {/* Application Detail Dialog */}
      <ApplicationDetailDialog
        application={selectedApplication}
        open={isDetailOpen}
        onClose={() => {
          setIsDetailOpen(false);
          setSelectedApplication(null);
        }}
        onUpdated={(updated) => {
          setSelectedApplication(updated);
          void refreshTracker();
        }}
        onDeleted={() => {
          setIsDetailOpen(false);
          setSelectedApplication(null);
          void refreshTracker();
        }}
      />
    </PageContainer>
  );
}
