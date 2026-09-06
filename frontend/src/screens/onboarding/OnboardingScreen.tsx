import { useState } from "react";
import { Link, useNavigate } from "react-router";
import { Check, ArrowRight, ArrowLeft, Upload, Sparkles, FileText, Loader2, Pencil } from "lucide-react";
import { Wordmark } from "../../components/rolebrief/Wordmark";
import { Button, Kicker, FilterChip, Badge } from "../../components/ui/primitives";
import { Input, Checkbox, SegmentedControl } from "../../components/ui/form";
import { disciplines } from "../../lib/fixtures";
import { classNames } from "../../lib/format";

const stepNames = ["Goal", "Reach", "Fit", "Review"] as const;

export function Component() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [roles, setRoles] = useState<string[]>(["Frontend"]);
  const [seniority, setSeniority] = useState("Mid");
  const [employment, setEmployment] = useState<string[]>(["Full-time"]);
  const [skills, setSkills] = useState<string[]>(["React", "TypeScript"]);
  const [remote, setRemote] = useState("Worldwide remote");
  const [relocate, setRelocate] = useState(false);
  const [resumeState, setResumeState] = useState<"none" | "processing" | "done">("none");

  function toggle(list: string[], set: (v: string[]) => void, v: string) {
    set(list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);
  }

  function uploadResume() {
    setResumeState("processing");
    setTimeout(() => {
      setResumeState("done");
      setSkills((s) => Array.from(new Set([...s, "Node.js", "GraphQL"])));
    }, 1600);
  }

  const next = () => (step < 3 ? setStep(step + 1) : navigate("/app/radar"));

  return (
    <div className="min-h-full paper-grain">
      <div className="mx-auto max-w-[900px] px-5 sm:px-8 py-8">
        <div className="flex items-center justify-end mb-4">
          <span className="text-[13px] text-slate font-data">Autosaved · you can leave and return</span>
        </div>
        {/* Progress */}
        <ol className="flex items-center gap-2 mb-10">
          {stepNames.map((name, i) => (
            <li key={name} className="flex items-center gap-2 grow last:grow-0">
              <span
                className={classNames(
                  "inline-flex items-center gap-2 text-[13px] font-medium",
                  i <= step ? "text-ink" : "text-slate",
                )}
              >
                <span className={classNames(
                  "inline-flex items-center justify-center size-6 rounded-full text-[12px] font-data",
                  i < step ? "bg-emerald text-white" : i === step ? "bg-indigo text-white" : "bg-white border border-line text-slate",
                )}>
                  {i < step ? <Check size={13} /> : i + 1}
                </span>
                <span className="hidden sm:inline">{name}</span>
              </span>
              {i < 3 && <span className={classNames("h-px grow", i < step ? "bg-emerald" : "bg-line")} />}
            </li>
          ))}
        </ol>

        <div className="rounded-[var(--radius-feature)] border border-line bg-white p-7 sm:p-9">
          {step === 0 && (
            <Section kicker="Goal" title="What are you looking for?" desc="We'll rank your Radar around this. You can change it any time.">
              <Field label="Target roles">
                <div className="flex flex-wrap gap-2">
                  {disciplines.map((d) => (
                    <FilterChip key={d} active={roles.includes(d)} onClick={() => toggle(roles, setRoles, d)}>
                      {d}
                    </FilterChip>
                  ))}
                </div>
              </Field>
              <Field label="Seniority">
                <SegmentedControl
                  value={seniority}
                  onChange={setSeniority}
                  options={["Junior", "Mid", "Senior", "Lead"].map((v) => ({ value: v, label: v }))}
                />
              </Field>
              <Field label="Employment type">
                <div className="flex flex-wrap gap-2">
                  {["Full-time", "Contract", "Internship", "Part-time"].map((e) => (
                    <FilterChip key={e} active={employment.includes(e)} onClick={() => toggle(employment, setEmployment, e)}>
                      {e}
                    </FilterChip>
                  ))}
                </div>
              </Field>
            </Section>
          )}

          {step === 1 && (
            <Section kicker="Reach" title="Where should we look?" desc="Locations and remote scope shape your Eligibility Shield.">
              <Field label="Countries & cities">
                <div className="flex flex-wrap gap-2">
                  {["Karachi", "Lahore", "Islamabad", "Dubai", "Abu Dhabi", "Anywhere"].map((c) => (
                    <FilterChip key={c} active={c === "Karachi" || c === "Anywhere"}>{c}</FilterChip>
                  ))}
                </div>
              </Field>
              <Field label="Remote scope">
                <SegmentedControl
                  value={remote}
                  onChange={setRemote}
                  options={["Worldwide remote", "Country remote", "Hybrid", "On-site"].map((v) => ({ value: v, label: v }))}
                />
              </Field>
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="rounded-[var(--radius-card)] border border-line p-4">
                  <Checkbox label="Open to relocation" checked={relocate} onChange={setRelocate} />
                </div>
                <div className="rounded-[var(--radius-card)] border border-line p-4">
                  <Checkbox label="I need visa sponsorship" checked={false} onChange={() => {}} />
                </div>
              </div>
            </Section>
          )}

          {step === 2 && (
            <Section kicker="Fit" title="What are your strengths?" desc="Skills power your Match Brief. A résumé is optional and everything stays editable.">
              <Field label="Skills">
                <div className="flex flex-wrap gap-2">
                  {["React", "TypeScript", "Node.js", "GraphQL", "Python", "AWS", "Kubernetes", "Figma"].map((s) => (
                    <FilterChip key={s} active={skills.includes(s)} onClick={() => toggle(skills, setSkills, s)}>
                      {s}
                    </FilterChip>
                  ))}
                </div>
              </Field>
              <Field label="Years of experience">
                <Input type="number" defaultValue={3} className="max-w-[120px]" />
              </Field>
              <Field label="Résumé (optional)">
                {resumeState === "none" && (
                  <button
                    onClick={uploadResume}
                    className="w-full rounded-[var(--radius-card)] border border-dashed border-line hover:border-indigo/50 hover:bg-soft transition-colors p-8 flex flex-col items-center gap-2 text-slate"
                  >
                    <Upload size={22} />
                    <span className="text-sm font-medium text-ink">Upload a résumé to speed things up</span>
                    <span className="text-[13px]">PDF or DOCX · we'll extract skills you can edit</span>
                  </button>
                )}
                {resumeState === "processing" && (
                  <div className="rounded-[var(--radius-card)] border border-line p-6 flex items-center gap-3 text-slate">
                    <Loader2 size={20} className="animate-spin text-indigo" />
                    <span className="text-sm">Reading your résumé… extracting skills and experience.</span>
                  </div>
                )}
                {resumeState === "done" && (
                  <div className="rounded-[var(--radius-card)] border border-emerald/30 bg-emerald-tint p-4">
                    <div className="flex items-center gap-2 text-sm text-ink">
                      <FileText size={16} className="text-emerald" /> ayesha-khan-cv.pdf
                      <Badge tone="emerald">Extracted</Badge>
                    </div>
                    <p className="text-[13px] text-slate mt-2 flex items-center gap-1.5">
                      <Sparkles size={13} className="text-indigo" /> Added <span className="font-medium text-ink">Node.js</span> and <span className="font-medium text-ink">GraphQL</span> — inferred, marked for your review.
                    </p>
                    <button className="text-[13px] text-indigo font-medium mt-2 inline-flex items-center gap-1">
                      <Pencil size={12} /> Review extracted data
                    </button>
                  </div>
                )}
              </Field>
            </Section>
          )}

          {step === 3 && (
            <Section kicker="Review" title="Here's your brief." desc="Confirm the essentials — you can refine everything later from your profile.">
              <div className="grid sm:grid-cols-2 gap-4">
                <ReviewRow label="Target roles" value={roles.join(", ")} />
                <ReviewRow label="Seniority" value={seniority} />
                <ReviewRow label="Employment" value={employment.join(", ")} />
                <ReviewRow label="Remote scope" value={remote} />
                <ReviewRow label="Skills" value={skills.join(", ")} />
                <ReviewRow label="Relocation" value={relocate ? "Open" : "Not now"} />
              </div>
              <label className="mt-2 flex items-start gap-3 rounded-[var(--radius-card)] bg-indigo-tint/60 border border-indigo/20 p-4">
                <Checkbox label="" checked onChange={() => {}} />
                <span className="text-sm text-ink -ml-1">
                  Create my first alert from this brief — <span className="text-slate">daily, in-app + email</span>
                </span>
              </label>
            </Section>
          )}

          <div className="mt-8 flex items-center justify-between gap-3">
            {step > 0 ? (
              <Button variant="tertiary" onClick={() => setStep(step - 1)} icon={<ArrowLeft size={16} />}>Back</Button>
            ) : (
              <Link to="/app/radar" className="text-sm text-slate hover:text-ink">Skip for now</Link>
            )}
            <Button onClick={next} size="lg" icon={<ArrowRight size={18} />}>
              {step === 3 ? "Go to my Radar" : "Continue"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Section({ kicker, title, desc, children }: { kicker: string; title: string; desc: string; children: React.ReactNode }) {
  return (
    <div>
      <Kicker className="mb-2">{kicker}</Kicker>
      <h1 className="text-2xl font-semibold text-ink">{title}</h1>
      <p className="text-slate mt-1.5">{desc}</p>
      <div className="mt-7 space-y-6">{children}</div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[13px] font-semibold text-ink mb-2.5">{label}</p>
      {children}
    </div>
  );
}

function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[var(--radius-card)] border border-line p-4">
      <p className="kicker mb-1.5">{label}</p>
      <p className="text-sm text-ink">{value}</p>
    </div>
  );
}
