import { useState, useEffect, useCallback } from "react";
import {
  Bell,
  Plus,
  Pause,
  Play,
  Trash2,
  X,
  Check,
  Sparkles,
  Loader2,
  ShieldCheck,
  Sliders,
  RefreshCw
} from "lucide-react";
import { PageContainer, PageHeader } from "../../shared/shell/AppShell";
import "../../shared/candidate/candidate-account.css";
import { Badge, Button, FilterChip, EmptyState } from "../../ui/primitives";
import { Input, SegmentedControl, Checkbox } from "../../ui/form";
import { Sheet } from "../../ui/overlay";
import { relativeTime } from "../../lib/core/format";
import { useToast } from "../../ui/toast";
import {
  getAlerts,
  createAlert,
  pauseAlert,
  resumeAlert,
  deleteAlert,
  type SerializedAlert,
  type CreateAlertInput,
  type AlertCadence,
  type AlertChannel,
  type AlertEligibilityPolicy,
  type AlertAlignmentTier
} from "../../lib/features/alerts-api";

export function Component() {
  const toast = useToast();
  const [alerts, setAlerts] = useState<SerializedAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [builderOpen, setBuilderOpen] = useState(false);

  const loadAlerts = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getAlerts();
      setAlerts(data);
    } catch (err: any) {
      toast({
        kind: "error",
        message: err.message || "Failed to load alerts."
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    loadAlerts();
  }, [loadAlerts]);

  async function handleToggleStatus(alert: SerializedAlert) {
    setActionLoadingId(alert.id);
    try {
      if (alert.status === "ACTIVE") {
        const updated = await pauseAlert(alert.id, alert.revision);
        setAlerts((prev) => prev.map((a) => (a.id === alert.id ? updated : a)));
        toast({ kind: "success", message: `Alert "${alert.name}" paused.` });
      } else {
        const updated = await resumeAlert(alert.id, alert.revision);
        setAlerts((prev) => prev.map((a) => (a.id === alert.id ? updated : a)));
        toast({ kind: "success", message: `Alert "${alert.name}" resumed.` });
      }
    } catch (err: any) {
      toast({
        kind: "error",
        message: err.message || "Could not update alert status."
      });
      // reload on conflict or out-of-sync
      loadAlerts();
    } finally {
      setActionLoadingId(null);
    }
  }

  async function handleDelete(alert: SerializedAlert) {
    if (!confirm(`Are you sure you want to delete "${alert.name}"?`)) return;
    setActionLoadingId(alert.id);
    try {
      await deleteAlert(alert.id);
      setAlerts((prev) => prev.filter((a) => a.id !== alert.id));
      toast({ kind: "info", message: `Alert "${alert.name}" deleted.` });
    } catch (err: any) {
      toast({
        kind: "error",
        message: err.message || "Could not delete alert."
      });
    } finally {
      setActionLoadingId(null);
    }
  }

  return (
    <PageContainer className="candidate-account candidate-alerts">
      <PageHeader
        title="Alerts"
        description="Monitor new roles that match your opportunity brief."
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              icon={<RefreshCw size={14} className={loading ? "animate-spin" : ""} />}
              onClick={() => loadAlerts()}
              disabled={loading}
            >
              Refresh
            </Button>
            <Button icon={<Plus size={16} />} onClick={() => setBuilderOpen(true)}>
              New alert
            </Button>
          </div>
        }
      />

      {loading && alerts.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-slate">
          <Loader2 size={32} className="animate-spin text-indigo mb-3" />
          <p className="text-sm">Loading your alerts...</p>
        </div>
      ) : alerts.length === 0 ? (
        <EmptyState
          icon={<Bell size={40} />}
          title="No alerts yet"
          body="Create your first alert to receive high-alignment roles automatically when new jobs are indexed."
          action={<Button onClick={() => setBuilderOpen(true)}>Create an alert</Button>}
        />
      ) : (
        <div className="space-y-4">
          {alerts.map((a) => {
            const isActing = actionLoadingId === a.id;
            const criteria = a.criteria;
            return (
              <div key={a.id} className="candidate-alert-row">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <Bell size={16} className={a.status === "ACTIVE" ? "text-indigo" : "text-slate"} />
                      <h3 className="font-semibold text-ink">{a.name}</h3>
                      <Badge tone={a.status === "ACTIVE" ? "emerald" : "amber"}>
                        {a.status === "ACTIVE" ? "Active" : "Paused"}
                      </Badge>
                      <Badge tone="indigo">
                        {criteria.alignment === "STRONG_ALIGNMENT"
                          ? "Strong Alignment"
                          : criteria.alignment === "PARTIAL_ALIGNMENT"
                          ? "Partial+ Alignment"
                          : "Any Alignment"}
                      </Badge>
                      {criteria.eligibilityPolicy === "ELIGIBLE_ONLY" && (
                        <Badge tone="emerald">
                          <span className="inline-flex items-center gap-1">
                            <ShieldCheck size={12} /> Eligible only
                          </span>
                        </Badge>
                      )}
                    </div>
                    <div className="mt-2.5 flex flex-wrap gap-1.5">
                      {criteria.targetTitles?.map((t) => (
                        <Badge key={t} tone="slate">
                          {t}
                        </Badge>
                      ))}
                      {criteria.workModes?.map((m) => (
                        <Badge key={m} tone="indigo">
                          {m}
                        </Badge>
                      ))}
                      {criteria.countryCodes?.map((c) => (
                        <Badge key={c} tone="slate">
                          {c}
                        </Badge>
                      ))}
                      {criteria.salaryDisclosed && (
                        <Badge tone="amber">Salary Disclosed</Badge>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 text-slate">
                    <Button
                      variant="tertiary"
                      size="sm"
                      disabled={isActing}
                      icon={
                        isActing ? (
                          <Loader2 size={14} className="animate-spin" />
                        ) : a.status === "ACTIVE" ? (
                          <Pause size={14} />
                        ) : (
                          <Play size={14} />
                        )
                      }
                      onClick={() => handleToggleStatus(a)}
                    >
                      {a.status === "ACTIVE" ? "Pause" : "Resume"}
                    </Button>
                    <Button
                      variant="tertiary"
                      size="sm"
                      disabled={isActing}
                      icon={<Trash2 size={14} />}
                      onClick={() => handleDelete(a)}
                    >
                      Delete
                    </Button>
                  </div>
                </div>
                <div className="mt-4 pt-3 border-t border-line flex flex-wrap items-center gap-x-6 gap-y-1 text-[13px] text-slate font-data">
                  <span>Cadence: <strong className="text-ink">{a.cadence}</strong></span>
                  <span>Channel: <strong className="text-ink">{a.channel}</strong></span>
                  {a.matchCount != null && <span>Matches: <strong className="text-ink">{a.matchCount}</strong></span>}
                  {a.lastDeliveredAt && <span>Last delivered: {relativeTime(a.lastDeliveredAt)}</span>}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <AlertBuilder
        open={builderOpen}
        onClose={() => setBuilderOpen(false)}
        onCreated={(created) => {
          setAlerts((prev) => [created, ...prev]);
          toast({ kind: "success", message: `Alert "${created.name}" created.` });
        }}
      />
    </PageContainer>
  );
}

interface AlertBuilderProps {
  open: boolean;
  onClose: () => void;
  onCreated: (created: SerializedAlert) => void;
}

function AlertBuilder({ open, onClose, onCreated }: AlertBuilderProps) {
  const toast = useToast();
  const [submitting, setSubmitting] = useState(false);

  // Natural language query / quick tags
  const [alertName, setAlertName] = useState("");
  const [titlesInput, setTitlesInput] = useState("");
  const [titles, setTitles] = useState<string[]>(["Software Engineer"]);
  const [workModes, setWorkModes] = useState<string[]>(["REMOTE"]);
  const [eligibilityPolicy, setEligibilityPolicy] = useState<AlertEligibilityPolicy>("ELIGIBLE_ONLY");
  const [alignment, setAlignment] = useState<AlertAlignmentTier>("STRONG_ALIGNMENT");
  const [cadence, setCadence] = useState<AlertCadence>("DAILY");
  const [channel, setChannel] = useState<AlertChannel>("BOTH");
  const [countryCodeInput, setCountryCodeInput] = useState("");
  const [countries, setCountries] = useState<string[]>([]);
  const [salaryDisclosed, setSalaryDisclosed] = useState(false);

  function handleAddTitle() {
    const trimmed = titlesInput.trim();
    if (trimmed && !titles.includes(trimmed)) {
      setTitles([...titles, trimmed]);
      setTitlesInput("");
      if (!alertName) {
        setAlertName(`${trimmed} Alert`);
      }
    }
  }

  function handleAddCountry() {
    const code = countryCodeInput.trim().toUpperCase();
    if (code && code.length === 2 && !countries.includes(code)) {
      setCountries([...countries, code]);
      setCountryCodeInput("");
    }
  }

  function toggleWorkMode(mode: string) {
    setWorkModes((prev) =>
      prev.includes(mode) ? prev.filter((m) => m !== mode) : [...prev, mode]
    );
  }

  async function handleConfirm() {
    if (titles.length === 0) {
      toast({ kind: "error", message: "Please specify at least one target role title." });
      return;
    }
    const name = alertName.trim() || `${titles[0]} Alert`;

    const input: CreateAlertInput = {
      name,
      channel,
      cadence,
      criteria: {
        targetTitles: titles,
        workModes: workModes.length ? workModes : ["REMOTE"],
        eligibilityPolicy,
        alignment,
        salaryDisclosed,
        countryCodes: countries.length ? countries : undefined
      }
    };

    setSubmitting(true);
    try {
      const created = await createAlert(input);
      onCreated(created);
      onClose();
    } catch (err: any) {
      toast({
        kind: "error",
        message: err.message || "Failed to create alert."
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Sheet
      className="candidate-account-sheet"
      manageFocus
      open={open}
      onClose={onClose}
      title="Create Smart Alert"
      side="right"
      footer={
        <div className="flex gap-2 w-full">
          <Button variant="secondary" className="grow" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button
            className="grow"
            icon={submitting ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
            onClick={handleConfirm}
            disabled={submitting || titles.length === 0}
          >
            {submitting ? "Creating..." : "Save Alert"}
          </Button>
        </div>
      }
    >
      <div className="space-y-6">
        <div>
          <label className="block text-sm font-semibold text-ink mb-1">Alert Name</label>
          <Input
            placeholder="e.g. Senior Backend roles"
            value={alertName}
            onChange={(e) => setAlertName(e.target.value)}
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-ink mb-1">Target Role Titles</label>
          <div className="flex gap-2 mb-2">
            <Input
              placeholder="e.g. Full Stack Engineer, Tech Lead"
              value={titlesInput}
              onChange={(e) => setTitlesInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleAddTitle();
                }
              }}
            />
            <Button variant="secondary" size="sm" onClick={handleAddTitle}>
              Add
            </Button>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {titles.map((t) => (
              <span
                key={t}
                className="inline-flex items-center gap-1.5 h-7 pl-2.5 pr-1.5 rounded-full bg-indigo-tint text-navy text-[13px] font-medium"
              >
                {t}
                <button
                  type="button"
                  aria-label={`Remove ${t}`}
                  onClick={() => setTitles(titles.filter((x) => x !== t))}
                  className="inline-flex items-center justify-center size-4 rounded-full hover:bg-white/60"
                >
                  <X size={11} />
                </button>
              </span>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-semibold text-ink mb-2">Work Modes</label>
          <div className="flex flex-wrap gap-2">
            {["REMOTE", "HYBRID", "ONSITE"].map((mode) => {
              const selected = workModes.includes(mode);
              return (
                <button
                  key={mode}
                  type="button"
                  onClick={() => toggleWorkMode(mode)}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
                    selected
                      ? "bg-indigo text-white border-indigo"
                      : "bg-white text-slate border-line hover:border-ink/40"
                  }`}
                >
                  {mode}
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <label className="block text-sm font-semibold text-ink mb-1">Country Filters (Optional ISO-2 codes)</label>
          <div className="flex gap-2 mb-2">
            <Input
              placeholder="e.g. US, GB, DE"
              maxLength={2}
              value={countryCodeInput}
              onChange={(e) => setCountryCodeInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleAddCountry();
                }
              }}
            />
            <Button variant="secondary" size="sm" onClick={handleAddCountry}>
              Add
            </Button>
          </div>
          {countries.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {countries.map((c) => (
                <span
                  key={c}
                  className="inline-flex items-center gap-1.5 h-7 pl-2.5 pr-1.5 rounded-full bg-soft text-ink text-[13px] font-medium"
                >
                  {c}
                  <button
                    type="button"
                    aria-label={`Remove ${c}`}
                    onClick={() => setCountries(countries.filter((x) => x !== c))}
                    className="inline-flex items-center justify-center size-4 rounded-full hover:bg-line"
                  >
                    <X size={11} />
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>

        <div>
          <label className="block text-sm font-semibold text-ink mb-2">Eligibility Shield Requirement</label>
          <SegmentedControl
            value={eligibilityPolicy}
            onChange={(v) => setEligibilityPolicy(v as AlertEligibilityPolicy)}
            options={[
              { value: "ELIGIBLE_ONLY", label: "Eligible Only" },
              { value: "ELIGIBLE_AND_UNKNOWN", label: "Eligible + Unknown" },
              { value: "ANY", label: "Any" }
            ]}
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-ink mb-2">Match Alignment Tier</label>
          <SegmentedControl
            value={alignment}
            onChange={(v) => setAlignment(v as AlertAlignmentTier)}
            options={[
              { value: "STRONG_ALIGNMENT", label: "Strong (>=70%)" },
              { value: "PARTIAL_ALIGNMENT", label: "Partial (>=40%)" },
              { value: "ANY", label: "Any Match" }
            ]}
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-ink mb-2">Cadence</label>
          <SegmentedControl
            value={cadence}
            onChange={(v) => setCadence(v as AlertCadence)}
            options={[
              { value: "INSTANT", label: "Instant" },
              { value: "DAILY", label: "Daily Digest" },
              { value: "WEEKLY", label: "Weekly Digest" }
            ]}
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-ink mb-2">Channels</label>
          <SegmentedControl
            value={channel}
            onChange={(v) => setChannel(v as AlertChannel)}
            options={[
              { value: "BOTH", label: "Both" },
              { value: "EMAIL", label: "Email" },
              { value: "IN_APP", label: "In-App" }
            ]}
          />
        </div>

        <div className="pt-2 border-t border-line">
          <Checkbox
            label="Require employer-disclosed salary"
            checked={salaryDisclosed}
            onChange={setSalaryDisclosed}
          />
        </div>
      </div>
    </Sheet>
  );
}
