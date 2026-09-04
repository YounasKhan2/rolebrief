import { useState } from "react";
import { FileText, Download, RefreshCw, Trash2, Pencil, Sparkles, Check, ShieldCheck, AlertTriangle, Upload } from "lucide-react";
import { Link } from "react-router";
import { PageContainer, PageHeader } from "../../components/shell/AppShell";
import { Kicker, Badge, Button, SectionRule } from "../../components/ui/primitives";
import { Dialog } from "../../components/ui/overlay";
import { useToast } from "../../components/ui/toast";
import { classNames } from "../../lib/format";

export function Component() {
  const toast = useToast();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [resumeState, setResumeState] = useState<"parsed" | "parsing" | "failed">("parsed");
  const completeness = 78;

  function reprocess() {
    setResumeState("parsing");
    toast({ kind: "info", message: "Reprocessing résumé…" });
    // Prototype: simulate a parsing pass that fails, so the fallback is visible.
    window.setTimeout(() => setResumeState("failed"), 1100);
  }

  const fields: { label: string; value: string; inferred?: boolean }[] = [
    { label: "Preferred roles", value: "Frontend, Full-stack" },
    { label: "Seniority", value: "Mid (3 yrs)" },
    { label: "Skills", value: "React, TypeScript, Node.js, GraphQL" },
    { label: "Node.js & GraphQL", value: "Inferred from résumé", inferred: true },
    { label: "Education", value: "BS Computer Science" },
    { label: "Location", value: "Karachi, Pakistan" },
    { label: "Remote scope", value: "Worldwide remote" },
    { label: "Work authorization", value: "Pakistan; open to relocation" },
    { label: "Salary preference", value: "Not disclosed" },
  ];

  return (
    <PageContainer className="max-w-[980px]">
      <PageHeader
        kicker="Candidate profile"
        title="What powers your matches."
        description="Only fields that materially improve matching. Your profile is private in the MVP."
        actions={<Button variant="secondary" icon={<Pencil size={16} />}>Edit profile</Button>}
      />

      {/* Completeness */}
      <div className="rounded-[var(--radius-card)] border border-line p-5 mb-6">
        <div className="flex items-center justify-between mb-2">
          <Kicker>Profile completeness</Kicker>
          <span className="font-data text-sm text-ink">{completeness}%</span>
        </div>
        <div className="h-2 rounded-full bg-line overflow-hidden">
          <div className="h-full bg-indigo rounded-full" style={{ width: `${completeness}%` }} />
        </div>
        <p className="text-[13px] text-slate mt-2">Add a salary preference and one more project to reach a stronger Match Brief.</p>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        {fields.map((f) => (
          <div key={f.label} className={classNames("rounded-[var(--radius-card)] border p-4", f.inferred ? "border-amber/30 bg-amber-tint/40" : "border-line")}>
            <div className="flex items-center justify-between">
              <Kicker>{f.label}</Kicker>
              {f.inferred && <Badge tone="amber"><Sparkles size={11} /> Inferred</Badge>}
            </div>
            <p className="text-sm text-ink mt-1.5">{f.value}</p>
            {f.inferred && (
              <div className="mt-2 flex gap-2">
                <button className="text-[12px] text-emerald font-medium inline-flex items-center gap-1" onClick={() => toast({ kind: "success", message: "Confirmed." })}><Check size={12} /> Confirm</button>
                <button className="text-[12px] text-slate hover:text-red">Remove</button>
              </div>
            )}
          </div>
        ))}
      </div>

      <SectionRule className="my-8" />

      {/* Résumé management */}
      <div className="rounded-[var(--radius-feature)] border border-line p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-ink">Résumé & inference review</h2>
          <Badge tone="emerald"><ShieldCheck size={12} /> Private</Badge>
        </div>
        <div className="flex flex-wrap items-center gap-3 rounded-[var(--radius-card)] bg-soft p-4">
          <FileText size={22} className={resumeState === "failed" ? "text-amber" : "text-indigo"} />
          <div className="grow min-w-0">
            <p className="text-sm font-medium text-ink">ayesha-khan-cv.pdf</p>
            <p className="text-[12px] text-slate font-data">
              {resumeState === "parsing" ? "Reading document…" : resumeState === "failed" ? "Uploaded 20 Aug 2026 · extraction incomplete" : "Uploaded 20 Aug 2026 · processed for skills"}
            </p>
          </div>
          <div className="flex items-center gap-1">
            <Button variant="tertiary" size="sm" icon={<Download size={14} />}>Download</Button>
            <Button variant="tertiary" size="sm" icon={<RefreshCw size={14} />} loading={resumeState === "parsing"} onClick={reprocess}>Reprocess</Button>
            <Button variant="tertiary" size="sm" icon={<Pencil size={14} />}>Replace</Button>
          </div>
        </div>

        {/* Résumé-parsing-failure state */}
        {resumeState === "failed" && (
          <div className="mt-3 rounded-[var(--radius-card)] border border-amber/30 bg-amber-tint/50 p-4">
            <div className="flex items-start gap-2.5">
              <AlertTriangle size={18} className="text-amber mt-0.5 shrink-0" />
              <div className="grow">
                <p className="text-sm font-semibold text-ink">We couldn't fully read this résumé</p>
                <p className="text-[13px] text-slate mt-1">
                  The file looks scanned or image-based, so we couldn't extract skills reliably. Nothing was guessed —
                  your existing fields are unchanged. You can retry, upload a text-based PDF, or enter your details by hand.
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button size="sm" icon={<Upload size={14} />} onClick={() => { setResumeState("parsed"); toast({ kind: "success", message: "Résumé processed." }); }}>Upload a different file</Button>
                  <Button variant="secondary" size="sm" onClick={reprocess}>Retry extraction</Button>
                  <Link to="#profile-fields" className="inline-flex items-center h-9 px-3 text-[13px] text-indigo font-medium hover:underline">Enter details manually</Link>
                </div>
              </div>
            </div>
          </div>
        )}

        <p className="text-[12px] text-slate mt-3">A résumé is optional. You can maintain a full profile without one, and every inferred field is yours to confirm or remove above.</p>
      </div>

      {/* Danger zone */}
      <div className="mt-6 rounded-[var(--radius-card)] border border-red/30 bg-red-tint/40 p-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-medium text-ink">Delete résumé & extracted data</p>
          <p className="text-[13px] text-slate">Removes the file and any inferred fields. This can't be undone.</p>
        </div>
        <Button variant="destructive" icon={<Trash2 size={16} />} onClick={() => setConfirmDelete(true)}>Delete data</Button>
      </div>

      <Dialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title="Delete résumé and extracted data?"
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirmDelete(false)}>Cancel</Button>
            <Button variant="destructive" onClick={() => { setConfirmDelete(false); toast({ kind: "success", message: "Résumé and extracted data deleted." }); }}>Delete permanently</Button>
          </>
        }
      >
        <p className="text-slate">Your inferred skills (Node.js, GraphQL) will be removed and your Match Brief will recalculate. Your manually-entered fields stay.</p>
      </Dialog>
    </PageContainer>
  );
}
