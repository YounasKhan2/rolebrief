import { createContext, useCallback, useContext, useState } from "react";
import type { ReactNode } from "react";
import { createPortal } from "react-dom";
import { CheckCircle2, Info, AlertTriangle, XCircle } from "lucide-react";
import { classNames } from "../../lib/format";

type ToastKind = "success" | "info" | "warning" | "error";
interface Toast {
  id: number;
  kind: ToastKind;
  message: string;
  undo?: () => void;
  actionLabel?: string;
}

const ToastContext = createContext<(t: Omit<Toast, "id">) => void>(() => {});

export function useToast() {
  return useContext(ToastContext);
}

const config: Record<ToastKind, { icon: ReactNode; klass: string }> = {
  success: { icon: <CheckCircle2 size={18} className="text-emerald" />, klass: "border-emerald/40" },
  info: { icon: <Info size={18} className="text-cyan" />, klass: "border-cyan/40" },
  warning: { icon: <AlertTriangle size={18} className="text-amber" />, klass: "border-amber/40" },
  error: { icon: <XCircle size={18} className="text-red" />, klass: "border-red/40" },
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const push = useCallback((t: Omit<Toast, "id">) => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { ...t, id }]);
    setTimeout(() => setToasts((prev) => prev.filter((x) => x.id !== id)), 4200);
  }, []);

  return (
    <ToastContext.Provider value={push}>
      {children}
      {createPortal(
        <div
          className="fixed z-[60] bottom-4 left-1/2 -translate-x-1/2 flex flex-col gap-2 w-[calc(100vw-2rem)] max-w-sm"
          role="status"
          aria-live="polite"
        >
          {toasts.map((t) => (
            <div
              key={t.id}
              className={classNames(
                "flex items-center gap-3 rounded-[var(--radius-control)] bg-white border shadow-[var(--shadow-raised)] px-4 py-3 text-sm",
                config[t.kind].klass,
              )}
            >
              {config[t.kind].icon}
              <span className="text-ink grow">{t.message}</span>
              {t.undo && (
                <button
                  onClick={() => {
                    t.undo?.();
                    setToasts((prev) => prev.filter((x) => x.id !== t.id));
                  }}
                  className="text-indigo font-medium shrink-0"
                >
                  {t.actionLabel ?? "Undo"}
                </button>
              )}
            </div>
          ))}
        </div>,
        document.body,
      )}
    </ToastContext.Provider>
  );
}
