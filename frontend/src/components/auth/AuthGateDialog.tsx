import { createContext, useCallback, useContext, useState } from "react";
import type { ReactNode } from "react";
import { useAuth } from "../../lib/auth";
import { Dialog } from "../ui/overlay";
import { Button, Kicker } from "../ui/primitives";
import { Input } from "../ui/form";
import { Mail, Lock, ArrowRight } from "lucide-react";

interface GateOptions {
  /** Human-readable verb, e.g. "save this role" */
  action: string;
  /** Called after the user successfully authenticates inside the dialog */
  onAuthenticated: () => void;
}

interface AuthGateContextValue {
  /** Wraps a gated action. If already authenticated, runs immediately. Otherwise opens the dialog. */
  gate: (opts: GateOptions) => void;
}

const AuthGateContext = createContext<AuthGateContextValue>({
  gate: () => {},
});

export function useAuthGate() {
  return useContext(AuthGateContext);
}

export function AuthGateProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated, login } = useAuth();
  const [pending, setPending] = useState<GateOptions | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const gate = useCallback(
    (opts: GateOptions) => {
      if (isAuthenticated) {
        opts.onAuthenticated();
        return;
      }
      setPending(opts);
      setError("");
    },
    [isAuthenticated],
  );

  function close() {
    setPending(null);
    setError("");
    setLoading(false);
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const email = fd.get("email") as string;
    const password = fd.get("password") as string;

    if (!email || !password) {
      setError("Please fill in all fields.");
      return;
    }

    setLoading(true);
    setError("");
    try {
      await login(email, password);
      // After successful login, execute the gated action
      pending?.onAuthenticated();
      close();
    } catch {
      setError("Something went wrong. Please try again.");
      setLoading(false);
    }
  }

  return (
    <AuthGateContext.Provider value={{ gate }}>
      {children}
      <Dialog
        open={pending !== null}
        onClose={close}
        title="Sign in to continue"
      >
        <p className="text-slate text-[15px] -mt-1 mb-5">
          Want to <span className="text-ink font-medium">{pending?.action ?? "do this"}</span>?
          Log in or create a free account to unlock this feature.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Email"
            name="email"
            type="email"
            placeholder="you@example.com"
            leading={<Mail size={16} />}
            autoComplete="email"
            required
          />
          <Input
            label="Password"
            name="password"
            type="password"
            placeholder="••••••••••"
            leading={<Lock size={16} />}
            autoComplete="current-password"
            required
          />

          {error && (
            <p className="text-red text-[13px]">{error}</p>
          )}

          <Button type="submit" className="w-full" size="lg" loading={loading} icon={<ArrowRight size={18} />}>
            Log in
          </Button>
        </form>

        <p className="text-center text-[13px] text-slate mt-5">
          New to RoleBrief?{" "}
          <a href="/signup" onClick={close} className="text-indigo font-medium">
            Create an account
          </a>
        </p>
      </Dialog>
    </AuthGateContext.Provider>
  );
}
