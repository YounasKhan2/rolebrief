import { useEffect, useRef } from "react";
import type { ReactNode } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { classNames } from "../../lib/format";
import { IconButton } from "./primitives";

function useLockScroll(open: boolean) {
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);
}

function useEscape(open: boolean, onClose: () => void) {
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);
}

export function Dialog({
  open,
  onClose,
  title,
  children,
  footer,
  className,
  manageFocus = false,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
  manageFocus?: boolean;
}) {
  useLockScroll(open);
  useEscape(open, onClose);
  const dialogRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open || !manageFocus) return;
    const previous = document.activeElement as HTMLElement | null;
    const panel = dialogRef.current;
    const controls = () => Array.from(panel?.querySelectorAll<HTMLElement>('button:not([disabled]),input:not([disabled]),textarea:not([disabled]),select:not([disabled]),a[href],[tabindex="0"]') ?? []).filter(el => el.getClientRects().length > 0);
    controls()[0]?.focus();
    const trap = (event: KeyboardEvent) => {
      if (event.key !== "Tab") return;
      const items = controls();
      const first = items[0], last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    panel?.addEventListener("keydown", trap);
    return () => { panel?.removeEventListener("keydown", trap); previous?.focus(); };
  }, [open, manageFocus]);
  if (!open) return null;
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-ink/40 animate-[fade_.2s_ease]" onClick={onClose} aria-hidden />
      <div
        role="dialog"
        ref={dialogRef}
        aria-modal="true"
        aria-label={title}
        className={classNames("relative w-full max-w-lg rounded-[var(--radius-feature)] bg-white shadow-[var(--shadow-raised)] p-6 animate-[pop_.2s_var(--ease-enter)]", className)}
      >
        <div className="flex items-start justify-between gap-4 mb-4">
          <h2 className="text-xl font-semibold text-ink">{title}</h2>
          <IconButton label="Close" onClick={onClose} className="-mr-2 -mt-2">
            <X size={18} />
          </IconButton>
        </div>
        <div>{children}</div>
        {footer && <div className="mt-6 flex justify-end gap-3">{footer}</div>}
      </div>
      <style>{`@keyframes fade{from{opacity:0}to{opacity:1}}@keyframes pop{from{opacity:0;transform:translateY(8px) scale(.98)}to{opacity:1;transform:none}}`}</style>
    </div>,
    document.body,
  );
}

export function Sheet({
  open,
  onClose,
  title,
  side = "bottom",
  children,
  footer,
  className,
  manageFocus = false,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  side?: "bottom" | "right";
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
  manageFocus?: boolean;
}) {
  useLockScroll(open);
  useEscape(open, onClose);
  const panelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open || !manageFocus) return;
    const previous = document.activeElement as HTMLElement | null;
    const panel = panelRef.current;
    const focusable = () => Array.from(panel?.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), select:not([disabled]), a[href], [tabindex="0"]') ?? []).filter(el => el.getClientRects().length > 0);
    focusable()[0]?.focus();
    function trap(event: KeyboardEvent) {
      if (event.key !== "Tab") return;
      const items = focusable();
      const first = items[0], last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    }
    panel?.addEventListener("keydown", trap);
    return () => { panel?.removeEventListener("keydown", trap); previous?.focus(); };
  }, [open, manageFocus]);
  if (!open) return null;
  return createPortal(
    <div className={classNames("fixed inset-0 z-50", className)}>
      <div className="absolute inset-0 bg-ink/40" onClick={onClose} aria-hidden />
      <div
        role="dialog"
        ref={panelRef}
        aria-modal="true"
        aria-label={title}
        className={classNames(
          "absolute bg-white shadow-[var(--shadow-sheet)] flex flex-col",
          side === "bottom"
            ? "inset-x-0 bottom-0 max-h-[88vh] rounded-t-[var(--radius-feature)] animate-[slideUp_.3s_var(--ease-enter)]"
            : "inset-y-0 right-0 w-full max-w-md rounded-l-[var(--radius-feature)] animate-[slideLeft_.3s_var(--ease-enter)]",
        )}
      >
        <div className="flex items-center justify-between gap-4 px-5 py-4 border-b border-line shrink-0">
          <h2 className="text-lg font-semibold text-ink">{title}</h2>
          <IconButton label="Close" onClick={onClose} className="-mr-2">
            <X size={18} />
          </IconButton>
        </div>
        <div className="overflow-y-auto scrollbar-thin px-5 py-4 grow" style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
          {children}
        </div>
        {footer && (
          <div className="shrink-0 border-t border-line px-5 py-3 flex gap-3" style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 12px)" }}>
            {footer}
          </div>
        )}
      </div>
      <style>{`@keyframes slideUp{from{transform:translateY(100%)}to{transform:none}}@keyframes slideLeft{from{transform:translateX(100%)}to{transform:none}}`}</style>
    </div>,
    document.body,
  );
}
