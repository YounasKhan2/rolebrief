import { forwardRef, useId } from "react";
import type { InputHTMLAttributes, TextareaHTMLAttributes, SelectHTMLAttributes, ReactNode } from "react";
import { classNames } from "../../lib/format";

const fieldBase =
  "w-full rounded-[var(--radius-control)] border bg-white text-ink text-sm px-3 " +
  "placeholder:text-slate/70 transition-colors duration-150 " +
  "focus:outline-none focus-visible:outline-none focus:border-indigo focus:ring-2 focus:ring-indigo/40 " +
  "disabled:bg-soft disabled:text-slate read-only:bg-soft";

function Label({ htmlFor, children, hint }: { htmlFor: string; children: ReactNode; hint?: string }) {
  return (
    <div className="flex items-baseline justify-between mb-1.5">
      <label htmlFor={htmlFor} className="text-[13px] font-semibold text-ink">
        {children}
      </label>
      {hint && <span className="text-[12px] text-slate">{hint}</span>}
    </div>
  );
}

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  hint?: string;
  error?: string;
  leading?: ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, hint, error, leading, id, className, ...rest },
  ref,
) {
  const autoId = useId();
  const fieldId = id ?? autoId;
  return (
    <div>
      {label && <Label htmlFor={fieldId} hint={hint}>{label}</Label>}
      <div className="relative">
        {leading && (
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate pointer-events-none">{leading}</span>
        )}
        <input
          ref={ref}
          id={fieldId}
          aria-invalid={!!error}
          aria-describedby={error ? `${fieldId}-error` : undefined}
          className={classNames(
            fieldBase,
            "h-11",
            leading ? "pl-9" : "",
            error ? "border-red focus:border-red focus:ring-red/30" : "border-line",
            className,
          )}
          {...rest}
        />
      </div>
      {error && (
        <p id={`${fieldId}-error`} className="mt-1.5 text-[12px] text-red">
          {error}
        </p>
      )}
    </div>
  );
});

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement> & { label?: string }>(
  function Textarea({ label, id, className, ...rest }, ref) {
    const autoId = useId();
    const fieldId = id ?? autoId;
    return (
      <div>
        {label && <Label htmlFor={fieldId}>{label}</Label>}
        <textarea
          ref={ref}
          id={fieldId}
          className={classNames(fieldBase, "py-2.5 min-h-24 border-line resize-y", className)}
          {...rest}
        />
      </div>
    );
  },
);

export function Select({
  label,
  children,
  id,
  className,
  ...rest
}: SelectHTMLAttributes<HTMLSelectElement> & { label?: string }) {
  const autoId = useId();
  const fieldId = id ?? autoId;
  return (
    <div>
      {label && <Label htmlFor={fieldId}>{label}</Label>}
      <select id={fieldId} className={classNames(fieldBase, "h-11 border-line pr-8 appearance-none", className)} {...rest}>
        {children}
      </select>
    </div>
  );
}

export function Checkbox({ label, checked, onChange, id }: { label: ReactNode; checked: boolean; onChange: (v: boolean) => void; id?: string }) {
  const autoId = useId();
  const fieldId = id ?? autoId;
  return (
    <label htmlFor={fieldId} className="flex items-center gap-2.5 cursor-pointer select-none py-1 min-h-11">
      <input
        id={fieldId}
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="size-[18px] rounded border-line text-indigo accent-indigo focus-visible:outline-2 focus-visible:outline-indigo"
      />
      <span className="text-sm text-ink">{label}</span>
    </label>
  );
}

export function Switch({ label, checked, onChange, description }: { label: string; checked: boolean; onChange: (v: boolean) => void; description?: string }) {
  return (
    <label className="flex items-start justify-between gap-4 cursor-pointer py-2">
      <span>
        <span className="block text-sm font-medium text-ink">{label}</span>
        {description && <span className="block text-[13px] text-slate mt-0.5">{description}</span>}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={() => onChange(!checked)}
        className={classNames(
          "relative h-6 w-11 shrink-0 rounded-full transition-colors duration-150",
          checked ? "bg-indigo" : "bg-line",
        )}
      >
        <span
          className={classNames(
            "absolute top-0.5 left-0.5 size-5 rounded-full bg-white shadow transition-transform duration-150",
            checked ? "translate-x-5" : "translate-x-0",
          )}
        />
      </button>
    </label>
  );
}

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  size = "md",
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  size?: "sm" | "md";
}) {
  return (
    <div className={classNames("inline-flex items-center gap-1 rounded-[var(--radius-control)] bg-soft p-1", size === "sm" ? "text-[13px]" : "text-sm")}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={value === o.value}
          onClick={() => onChange(o.value)}
          className={classNames(
            "rounded-[7px] font-medium transition-colors duration-150",
            size === "sm" ? "h-8 px-3" : "h-9 px-3.5",
            value === o.value ? "bg-white text-ink shadow-sm" : "text-slate hover:text-ink",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Tabs<T extends string>({
  tabs,
  value,
  onChange,
}: {
  tabs: { value: T; label: string; count?: number }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div role="tablist" className="flex items-center gap-6 border-b border-line">
      {tabs.map((t) => (
        <button
          key={t.value}
          role="tab"
          aria-selected={value === t.value}
          onClick={() => onChange(t.value)}
          className={classNames(
            "relative -mb-px py-3 text-sm font-medium transition-colors",
            value === t.value ? "text-ink" : "text-slate hover:text-ink",
          )}
        >
          {t.label}
          {typeof t.count === "number" && <span className="ml-1.5 text-slate font-data text-[12px]">{t.count}</span>}
          {value === t.value && <span className="absolute inset-x-0 -bottom-px h-0.5 bg-indigo rounded-full" />}
        </button>
      ))}
    </div>
  );
}
