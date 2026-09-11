import { classNames } from "../../lib/core/format";

// Wordmark-led identity. The mark is a folded briefing page whose corner becomes a
// forward signal — not a résumé, magnifier, briefcase, robot or sparkle.

export function BriefMark({ size = 28, className, reversed }: { size?: number; className?: string; reversed?: boolean }) {
  const fold = reversed ? "#f7f4ee" : "#4f46e5";
  const page = reversed ? "#ffffff" : "#172554";
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      className={className}
      aria-hidden
    >
      {/* briefing page */}
      <path d="M7 4h13l5 5v19a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1Z" fill={page} />
      {/* folded corner → forward signal */}
      <path d="M20 4l5 5h-5V4Z" fill={fold} />
      {/* three brief lines, last one becomes a forward tick */}
      <rect x="10" y="14" width="12" height="1.6" rx="0.8" fill={reversed ? "#151a23" : "#f7f4ee"} opacity="0.9" />
      <rect x="10" y="18" width="9" height="1.6" rx="0.8" fill={reversed ? "#151a23" : "#f7f4ee"} opacity="0.7" />
      <path d="M10 23h6l-2-2m2 2-2 2" stroke={fold} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function Wordmark({
  size = "md",
  reversed,
  className,
}: {
  size?: "sm" | "md" | "lg";
  reversed?: boolean;
  className?: string;
}) {
  const markSize = size === "lg" ? 32 : size === "sm" ? 22 : 26;
  const text = size === "lg" ? "text-2xl" : size === "sm" ? "text-lg" : "text-xl";
  return (
    <span className={classNames("inline-flex items-center gap-2", className)}>
      <BriefMark size={markSize} reversed={reversed} />
      <span className={classNames("font-display font-semibold tracking-tight", text, reversed ? "text-paper" : "text-navy")}>
        Role<span className={reversed ? "text-white/80" : "text-ink"}>Brief</span>
      </span>
    </span>
  );
}

