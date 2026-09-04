import { forwardRef } from "react";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { Link } from "react-router";
import { classNames, brandColor, initials } from "../../lib/format";

// ---- Button ---------------------------------------------------------------

type ButtonVariant = "primary" | "secondary" | "tertiary" | "destructive";
type ButtonSize = "sm" | "md" | "lg";

const buttonBase =
  "inline-flex items-center justify-center gap-2 font-medium rounded-[var(--radius-control)] " +
  "transition-[background,color,border-color,transform] duration-150 ease-[var(--ease-standard)] " +
  "disabled:opacity-50 disabled:pointer-events-none active:scale-[0.985] select-none";

const buttonVariants: Record<ButtonVariant, string> = {
  primary: "bg-indigo text-white hover:bg-indigo-strong",
  secondary: "bg-white text-ink border border-ink/80 hover:bg-soft",
  tertiary: "bg-transparent text-indigo hover:bg-indigo-tint",
  destructive: "bg-red text-white hover:brightness-95",
};

const buttonSizes: Record<ButtonSize, string> = {
  sm: "h-9 px-3 text-[13px]",
  md: "h-11 px-4 text-sm",
  lg: "h-12 px-6 text-[15px]",
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  icon?: ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "primary", size = "md", loading, icon, children, className, disabled, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={classNames(buttonBase, buttonVariants[variant], buttonSizes[size], className)}
      {...rest}
    >
      {loading && (
        <span className="size-4 rounded-full border-2 border-current border-t-transparent animate-spin" aria-hidden />
      )}
      {!loading && icon}
      {children}
    </button>
  );
});

export function LinkButton({
  to,
  variant = "primary",
  size = "md",
  icon,
  children,
  className,
}: {
  to: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Link
      to={to}
      className={classNames(buttonBase, buttonVariants[variant], buttonSizes[size], className)}
    >
      {icon}
      {children}
    </Link>
  );
}

export function IconButton({
  label,
  children,
  className,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button
      aria-label={label}
      title={label}
      className={classNames(
        "inline-flex items-center justify-center size-11 rounded-[var(--radius-control)] text-slate",
        "hover:bg-soft hover:text-ink transition-colors duration-150",
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}

// ---- Badge & chips --------------------------------------------------------

type Tone = "ink" | "indigo" | "cyan" | "emerald" | "amber" | "red" | "slate";

const toneText: Record<Tone, string> = {
  ink: "text-ink",
  indigo: "text-indigo",
  cyan: "text-cyan",
  emerald: "text-emerald",
  amber: "text-amber",
  red: "text-red",
  slate: "text-slate",
};
const toneBg: Record<Tone, string> = {
  ink: "bg-ink/5",
  indigo: "bg-indigo-tint",
  cyan: "bg-cyan-tint",
  emerald: "bg-emerald-tint",
  amber: "bg-amber-tint",
  red: "bg-red-tint",
  slate: "bg-soft",
};

export function Badge({ tone = "slate", children }: { tone?: Tone; children: ReactNode }) {
  return (
    <span
      className={classNames(
        "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[12px] font-medium leading-5",
        toneBg[tone],
        toneText[tone],
      )}
    >
      {children}
    </span>
  );
}

export function FilterChip({
  active,
  excluded,
  children,
  onClick,
  disabled,
}: {
  active?: boolean;
  excluded?: boolean;
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={active}
      className={classNames(
        "inline-flex items-center gap-1.5 h-9 px-3 rounded-[var(--radius-control)] text-[13px] font-medium",
        "border transition-colors duration-150 disabled:opacity-40",
        excluded
          ? "border-red bg-red-tint text-red line-through"
          : active
            ? "border-indigo bg-indigo text-white"
            : "border-line bg-white text-ink hover:border-ink/40",
      )}
    >
      {children}
    </button>
  );
}

// ---- Structural devices ---------------------------------------------------

export function Kicker({ children, className }: { children: ReactNode; className?: string }) {
  return <p className={classNames("kicker", className)}>{children}</p>;
}

export function SectionRule({ className }: { className?: string }) {
  return <hr className={classNames("border-0 border-t border-line", className)} />;
}

// ---- Company logo fallback ------------------------------------------------

export function CompanyLogo({ name, size = 40 }: { name: string; size?: number }) {
  return (
    <span
      aria-hidden
      style={{ width: size, height: size, background: brandColor(name) }}
      className="inline-flex items-center justify-center rounded-[10px] text-white font-semibold shrink-0"
    >
      <span style={{ fontSize: size * 0.36 }}>{initials(name)}</span>
    </span>
  );
}

// ---- Source badge ---------------------------------------------------------

export function SourceBadge({ source, domain }: { source: string; domain?: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-[12px] text-slate font-data">
      <span className="size-1.5 rounded-full bg-slate/60" aria-hidden />
      {source}
      {domain ? <span className="text-slate/70">· {domain}</span> : null}
    </span>
  );
}

// ---- Skeleton, empty & error ----------------------------------------------

export function Skeleton({ className }: { className?: string }) {
  return <div className={classNames("animate-pulse rounded-md bg-line/60", className)} aria-hidden />;
}

export function EmptyState({
  icon,
  title,
  body,
  action,
}: {
  icon?: ReactNode;
  title: string;
  body: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center text-center gap-3 py-16 px-6">
      {icon && <div className="text-slate">{icon}</div>}
      <h3 className="text-lg font-semibold text-ink">{title}</h3>
      <p className="text-slate max-w-sm">{body}</p>
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
