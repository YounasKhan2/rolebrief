import { useState, useEffect } from "react";
import { Dialog } from "../ui/overlay";
import { Button, Badge } from "../ui/primitives";
import { Input, Textarea, Select } from "../ui/form";
import { useTracker } from "../../lib/tracker-context";
import { ApplicationStage, TrackedApplication } from "../../lib/tracker-api";
import {
  Calendar,
  Building2,
  ExternalLink,
  Trash2,
  Clock,
  History,
  AlertTriangle,
  CheckCircle2,
  Save
} from "lucide-react";

export const ALLOWED_TRANSITIONS: Record<ApplicationStage, ApplicationStage[]> = {
  SAVED: ["APPLIED", "WITHDRAWN"],
  APPLIED: ["SAVED", "INTERVIEWING", "REJECTED", "WITHDRAWN"],
  INTERVIEWING: ["APPLIED", "OFFER", "REJECTED", "WITHDRAWN"],
  OFFER: ["INTERVIEWING", "REJECTED", "WITHDRAWN"],
  REJECTED: ["APPLIED", "INTERVIEWING"],
  WITHDRAWN: ["SAVED", "APPLIED"]
};

export const STAGE_LABELS: Record<ApplicationStage, string> = {
  SAVED: "Saved",
  APPLIED: "Applied",
  INTERVIEWING: "Interviewing",
  OFFER: "Offer Received",
  REJECTED: "Rejected",
  WITHDRAWN: "Withdrawn"
};

export const STAGE_TONES: Record<
  ApplicationStage,
  "neutral" | "brand" | "amber" | "green" | "red"
> = {
  SAVED: "neutral",
  APPLIED: "brand",
  INTERVIEWING: "amber",
  OFFER: "green",
  REJECTED: "red",
  WITHDRAWN: "neutral"
};

interface ApplicationDetailDialogProps {
  application: TrackedApplication | null;
  open: boolean;
  onClose: () => void;
  onUpdated?: (updated: TrackedApplication) => void;
  onDeleted?: (id: string) => void;
}

export function ApplicationDetailDialog({
  application,
  open,
  onClose,
  onUpdated,
  onDeleted
}: ApplicationDetailDialogProps) {
  const { updateStage, updateApplication, deleteApplication } = useTracker();

  const [targetStage, setTargetStage] = useState<ApplicationStage>("SAVED");
  const [stageNote, setStageNote] = useState("");
  const [isChangingStage, setIsChangingStage] = useState(false);

  const [notes, setNotes] = useState("");
  const [nextAction, setNextAction] = useState("");
  const [nextActionAt, setNextActionAt] = useState("");
  const [appliedAt, setAppliedAt] = useState("");
  const [interviewAt, setInterviewAt] = useState("");
  const [reminderAt, setReminderAt] = useState("");
  const [isSavingDetails, setIsSavingDetails] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (application) {
      setTargetStage(application.stage);
      setStageNote("");
      setNotes(application.notes || "");
      setNextAction(application.nextAction || "");
      setNextActionAt(application.nextActionAt ? application.nextActionAt.slice(0, 10) : "");
      setAppliedAt(application.appliedAt ? application.appliedAt.slice(0, 10) : "");
      setInterviewAt(application.interviewAt ? application.interviewAt.slice(0, 10) : "");
      setReminderAt(application.reminderAt ? application.reminderAt.slice(0, 10) : "");
      setError("");
    }
  }, [application]);

  if (!application) return null;

  const validNextStages = ALLOWED_TRANSITIONS[application.stage] || [];

  const handleStageChange = async () => {
    if (targetStage === application.stage) return;
    setIsChangingStage(true);
    setError("");

    try {
      const updated = await updateStage(
        application.id,
        targetStage,
        application.revision,
        stageNote.trim() || undefined
      );
      if (updated) {
        onUpdated?.(updated);
        setStageNote("");
      }
    } catch (err: any) {
      setError(err?.message || "Failed to update stage");
    } finally {
      setIsChangingStage(false);
    }
  };

  const handleSaveDetails = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingDetails(true);
    setError("");

    try {
      const updated = await updateApplication(application.id, {
        expectedRevision: application.revision,
        notes: notes.trim() || undefined,
        nextAction: nextAction.trim() || undefined,
        nextActionAt: nextActionAt ? new Date(nextActionAt).toISOString() : undefined,
        appliedAt: appliedAt ? new Date(appliedAt).toISOString() : undefined,
        interviewAt: interviewAt ? new Date(interviewAt).toISOString() : undefined,
        reminderAt: reminderAt ? new Date(reminderAt).toISOString() : undefined
      });

      if (updated) {
        onUpdated?.(updated);
      }
    } catch (err: any) {
      setError(err?.message || "Failed to save details");
    } finally {
      setIsSavingDetails(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm(`Are you sure you want to remove "${application.roleTitle}" from tracker?`)) {
      return;
    }

    setIsDeleting(true);
    try {
      const ok = await deleteApplication(application.id, application.revision);
      if (ok) {
        onDeleted?.(application.id);
        onClose();
      }
    } catch (err: any) {
      setError(err?.message || "Failed to delete application");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Application Details"
      footer={
        <div className="w-full flex items-center justify-between">
          <Button
            variant="secondary"
            className="text-red hover:bg-red/10 border-red/30"
            onClick={handleDelete}
            disabled={isDeleting || isSavingDetails || isChangingStage}
            icon={<Trash2 size={15} />}
          >
            {isDeleting ? "Removing..." : "Remove"}
          </Button>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={onClose}>
              Close
            </Button>
            <Button
              variant="primary"
              onClick={handleSaveDetails as any}
              disabled={isSavingDetails || isChangingStage}
              icon={<Save size={15} />}
            >
              {isSavingDetails ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </div>
      }
    >
      <div className="space-y-6 max-h-[70vh] overflow-y-auto px-1 py-0.5">
        {error && (
          <div className="rounded-lg bg-red/10 border border-red/20 px-3 py-2 text-xs text-red font-medium">
            {error}
          </div>
        )}

        {/* Header Summary */}
        <div className="border border-line rounded-xl p-4 bg-soft/50 space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-lg font-bold text-ink leading-snug">
                {application.roleTitle}
              </h3>
              <div className="flex items-center gap-2 mt-1 text-sm text-slate">
                <Building2 size={15} />
                <span>{application.companyName || "Unknown Company"}</span>
                {application.locationLabel && (
                  <>
                    <span>·</span>
                    <span>{application.locationLabel}</span>
                  </>
                )}
              </div>
            </div>
            <div className="flex flex-col items-end gap-1.5">
              <Badge tone={STAGE_TONES[application.stage]}>
                {STAGE_LABELS[application.stage]}
              </Badge>
              {application.isJobExpired && (
                <Badge tone="red">
                  Expired listing
                </Badge>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-line/60 text-xs text-slate">
            {application.jobSlug && (
              <a
                href={`/app/jobs/${application.jobSlug}`}
                className="inline-flex items-center gap-1 text-indigo hover:underline font-medium"
              >
                <span>View Job Details</span>
                <ExternalLink size={12} />
              </a>
            )}
            {application.applicationUrl && (
              <>
                <span>·</span>
                <a
                  href={application.applicationUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-indigo hover:underline font-medium"
                >
                  <span>Listing Link</span>
                  <ExternalLink size={12} />
                </a>
              </>
            )}
            {application.sourceLabel && (
              <>
                <span>·</span>
                <span>Source: {application.sourceLabel}</span>
              </>
            )}
            <span className="ml-auto text-slate/80">Rev {application.revision}</span>
          </div>
        </div>

        {/* Stage Transition Control */}
        <div className="border border-line rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate">
              Update Stage
            </span>
            <span className="text-xs text-slate">
              Current: <strong className="text-ink">{STAGE_LABELS[application.stage]}</strong>
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 items-center">
            <Select
              className="sm:col-span-1"
              value={targetStage}
              onChange={(e) => setTargetStage(e.target.value as ApplicationStage)}
              disabled={isChangingStage}
            >
              <option value={application.stage}>Current: {STAGE_LABELS[application.stage]}</option>
              {validNextStages.map((st) => (
                <option key={st} value={st}>
                  Move to: {STAGE_LABELS[st]}
                </option>
              ))}
            </Select>

            <Input
              className="sm:col-span-1"
              placeholder="Transition note (optional)"
              value={stageNote}
              onChange={(e) => setStageNote(e.target.value)}
              disabled={isChangingStage || targetStage === application.stage}
            />

            <Button
              className="sm:col-span-1"
              variant="secondary"
              onClick={handleStageChange}
              disabled={isChangingStage || targetStage === application.stage}
              icon={<CheckCircle2 size={16} />}
            >
              {isChangingStage ? "Moving..." : "Change Stage"}
            </Button>
          </div>
        </div>

        {/* Dates & Actions */}
        <div className="border border-line rounded-xl p-4 space-y-3">
          <span className="text-xs font-bold uppercase tracking-wider text-slate">
            Dates & Next Steps
          </span>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              label="Applied Date"
              type="date"
              value={appliedAt}
              onChange={(e) => setAppliedAt(e.target.value)}
              leading={<Calendar size={15} />}
            />

            <Input
              label="Interview Scheduled"
              type="date"
              value={interviewAt}
              onChange={(e) => setInterviewAt(e.target.value)}
              leading={<Calendar size={15} />}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              label="Next Action"
              placeholder="e.g. Follow up on technical assessment"
              value={nextAction}
              onChange={(e) => setNextAction(e.target.value)}
            />

            <Input
              label="Action Deadline"
              type="date"
              value={nextActionAt}
              onChange={(e) => setNextActionAt(e.target.value)}
              leading={<Clock size={15} />}
            />
          </div>
        </div>

        {/* Notes */}
        <div className="border border-line rounded-xl p-4 space-y-3">
          <span className="text-xs font-bold uppercase tracking-wider text-slate">
            Notes & Intelligence
          </span>
          <Textarea
            rows={4}
            placeholder="Add interview feedback, questions asked, salary discussion notes, or team details..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>

        {/* Status History Timeline */}
        <div className="border border-line rounded-xl p-4 space-y-3">
          <div className="flex items-center gap-2">
            <History size={16} className="text-slate" />
            <span className="text-xs font-bold uppercase tracking-wider text-slate">
              Stage History Timeline
            </span>
          </div>

          {application.history && application.history.length > 0 ? (
            <div className="space-y-2.5 pt-1">
              {application.history.map((h) => (
                <div
                  key={h.id}
                  className="flex items-start gap-3 text-xs border-l-2 border-line pl-3 py-1"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-ink">
                        {h.fromStage ? `${STAGE_LABELS[h.fromStage]} → ` : "Tracked as "}
                        <span className="text-indigo">{STAGE_LABELS[h.toStage]}</span>
                      </span>
                      <span className="text-slate/70">
                        {new Date(h.occurredAt).toLocaleDateString(undefined, {
                          month: "short",
                          day: "numeric",
                          year: "numeric"
                        })}
                      </span>
                    </div>
                    {h.note && <p className="text-slate mt-0.5">{h.note}</p>}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-slate">No historical transitions recorded yet.</p>
          )}
        </div>
      </div>
    </Dialog>
  );
}
