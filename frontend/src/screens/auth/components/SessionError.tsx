import { AlertTriangle, RefreshCw, ArrowLeft } from "lucide-react";
import { Link } from "react-router";
import { Button } from "../../../ui/primitives";

export function SessionError({
  message = "Could not reach the authentication service to verify your session.",
  onRetry,
}: {
  message?: string;
  onRetry?: () => void;
}) {
  return (
    <div
      role="alert"
      aria-live="assertive"
      className="mx-auto max-w-md px-6 py-20 text-center"
    >
      <div className="inline-flex items-center justify-center size-12 rounded-full bg-amber-50 text-amber-600 mb-4">
        <AlertTriangle size={24} />
      </div>
      <h2 className="text-xl font-semibold text-ink">Session check failed</h2>
      <p className="mt-2 text-sm text-slate leading-relaxed">{message}</p>
      <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
        {onRetry && (
          <Button variant="secondary" onClick={onRetry} icon={<RefreshCw size={15} />}>
            Retry session check
          </Button>
        )}
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-indigo hover:text-indigo/80 px-3 py-2"
        >
          <ArrowLeft size={15} /> Return to home
        </Link>
      </div>
    </div>
  );
}
