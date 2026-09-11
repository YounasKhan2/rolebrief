import { useState } from "react";
import { Dialog } from "../ui/overlay";
import { Button } from "../ui/primitives";
import { Input, Textarea, Select } from "../ui/form";
import { useTracker } from "../../lib/tracker-context";
import { ApplicationStage } from "../../lib/tracker-api";
import { Briefcase, Building2, Calendar, Link2, User, Mail, Sparkles } from "lucide-react";

interface AddApplicationDialogProps {
  open: boolean;
  onClose: () => void;
  onCreated?: () => void;
}

export function AddApplicationDialog({
  open,
  onClose,
  onCreated
}: AddApplicationDialogProps) {
  const { addManualApplication } = useTracker();

  const [roleTitle, setRoleTitle] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [stage, setStage] = useState<ApplicationStage>("APPLIED");
  const [appliedAt, setAppliedAt] = useState(() => new Date().toISOString().slice(0, 10));
  const [nextAction, setNextAction] = useState("");
  const [nextActionAt, setNextActionAt] = useState("");
  const [sourceLabel, setSourceLabel] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [contactName, setContactName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [notes, setNotes] = useState("");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  const resetForm = () => {
    setRoleTitle("");
    setCompanyName("");
    setStage("APPLIED");
    setAppliedAt(new Date().toISOString().slice(0, 10));
    setNextAction("");
    setNextActionAt("");
    setSourceLabel("");
    setSourceUrl("");
    setContactName("");
    setContactEmail("");
    setNotes("");
    setError("");
  };

  const handleClose = () => {
    if (isSubmitting) return;
    resetForm();
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!roleTitle.trim()) {
      setError("Job title is required");
      return;
    }

    setIsSubmitting(true);
    setError("");

    try {
      const result = await addManualApplication({
        roleTitle: roleTitle.trim(),
        companyName: companyName.trim() || undefined,
        stage,
        appliedAt: appliedAt ? new Date(appliedAt).toISOString() : undefined,
        nextAction: nextAction.trim() || undefined,
        nextActionAt: nextActionAt ? new Date(nextActionAt).toISOString() : undefined,
        sourceLabel: sourceLabel.trim() || undefined,
        sourceUrl: sourceUrl.trim() || undefined,
        contactName: contactName.trim() || undefined,
        contactEmail: contactEmail.trim() || undefined,
        notes: notes.trim() || undefined
      });

      if (result) {
        resetForm();
        onClose();
        onCreated?.();
      }
    } catch (err: any) {
      setError(err?.message || "Failed to save application");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog
      className="pipeline-dialog"
      manageFocus
      open={open}
      onClose={handleClose}
      title="Track New Application"
      footer={
        <>
          <Button variant="secondary" onClick={handleClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handleSubmit as any}
            disabled={isSubmitting}
            icon={<Sparkles size={16} />}
          >
            {isSubmitting ? "Saving..." : "Add to Tracker"}
          </Button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4 max-h-[70vh] overflow-y-auto px-1 py-0.5">
        {error && (
          <div className="rounded-lg bg-red/10 border border-red/20 px-3 py-2 text-xs text-red font-medium">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Input
            label="Role Title *"
            placeholder="e.g. Senior Frontend Engineer"
            value={roleTitle}
            onChange={(e) => setRoleTitle(e.target.value)}
            leading={<Briefcase size={16} />}
            required
            autoFocus
          />

          <Input
            label="Company Name"
            placeholder="e.g. Acme Inc"
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
            leading={<Building2 size={16} />}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Select
            label="Current Stage"
            value={stage}
            onChange={(e) => setStage(e.target.value as ApplicationStage)}
          >
            <option value="SAVED">Saved (Considering)</option>
            <option value="APPLIED">Applied (Submitted)</option>
            <option value="INTERVIEWING">Interviewing</option>
            <option value="OFFER">Offer Received</option>
            <option value="REJECTED">Rejected</option>
            <option value="WITHDRAWN">Withdrawn</option>
          </Select>

          <Input
            label="Date Applied"
            type="date"
            value={appliedAt}
            onChange={(e) => setAppliedAt(e.target.value)}
            leading={<Calendar size={16} />}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Input
            label="Next Action"
            placeholder="e.g. Follow up with recruiter"
            value={nextAction}
            onChange={(e) => setNextAction(e.target.value)}
          />

          <Input
            label="Target Date"
            type="date"
            value={nextActionAt}
            onChange={(e) => setNextActionAt(e.target.value)}
            leading={<Calendar size={16} />}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Input
            label="Source Platform"
            placeholder="e.g. LinkedIn, Referral, Himalayas"
            value={sourceLabel}
            onChange={(e) => setSourceLabel(e.target.value)}
          />

          <Input
            label="Application / Listing URL"
            type="url"
            placeholder="https://company.com/jobs/..."
            value={sourceUrl}
            onChange={(e) => setSourceUrl(e.target.value)}
            leading={<Link2 size={16} />}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Input
            label="Contact Name"
            placeholder="e.g. Recruiter or Hiring Manager"
            value={contactName}
            onChange={(e) => setContactName(e.target.value)}
            leading={<User size={16} />}
          />

          <Input
            label="Contact Email"
            type="email"
            placeholder="recruiter@company.com"
            value={contactEmail}
            onChange={(e) => setContactEmail(e.target.value)}
            leading={<Mail size={16} />}
          />
        </div>

        <Textarea
          label="Notes & Context"
          placeholder="Key interview notes, referral details, tech stack highlights, or compensation details..."
          rows={3}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </form>
    </Dialog>
  );
}
