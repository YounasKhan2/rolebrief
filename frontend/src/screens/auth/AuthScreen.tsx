import { useLocation, Link, useNavigate, Navigate, useSearchParams } from "react-router";
import { useState } from "react";
import { Mail, Lock, ArrowRight, CheckCircle2, User } from "lucide-react";
import { Wordmark } from "../../components/rolebrief/Wordmark";
import { Button, Kicker } from "../../components/ui/primitives";
import { Input } from "../../components/ui/form";
import { useAuth } from "../../lib/auth";
import * as authApi from "../../lib/auth-api";
import { ApiError } from "../../lib/api";

type Mode = "login" | "signup" | "forgot-password" | "reset-password" | "verify-email";

const copy: Record<Mode, { kicker: string; title: string; sub: string; cta: string }> = {
  login: { kicker: "Welcome back", title: "Log in to RoleBrief", sub: "Pick up your brief where you left it.", cta: "Log in" },
  signup: { kicker: "Get started", title: "Create your account", sub: "Build an opportunity brief in a few minutes.", cta: "Create account" },
  "forgot-password": { kicker: "Account recovery", title: "Reset your password", sub: "We'll email you a secure reset link.", cta: "Send reset link" },
  "reset-password": { kicker: "Account recovery", title: "Choose a new password", sub: "Use at least 12 characters.", cta: "Update password" },
  "verify-email": { kicker: "One more step", title: "Verify your email", sub: "We sent a link to your inbox. Open it to activate alerts.", cta: "Resend email" },
};

/** Only accept relative, same-origin return paths. */
function safeReturnTo(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  if (!raw.startsWith("/") || raw.startsWith("//")) return null;
  return raw;
}

export function Component() {
  const { pathname, state } = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { isAuthenticated, status, login, signup } = useAuth();
  const mode = (pathname.replace("/", "") || "login") as Mode;
  const c = copy[mode];
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const returnTo = safeReturnTo(state?.returnTo);

  if (status === "loading") {
    return <div className="mx-auto max-w-md px-5 sm:px-8 py-16 lg:py-24 text-center text-slate">Checking your session...</div>;
  }

  // Already authenticated — redirect away from auth pages
  if (isAuthenticated && (mode === "login" || mode === "signup")) {
    return <Navigate to={returnTo ?? "/app/radar"} replace />;
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    setMessage("");
    try {
      const form = e.target as HTMLFormElement;
      const fd = new FormData(form);
      if (mode === "forgot-password") {
        const result = await authApi.forgotPassword((fd.get("email") as string) ?? "");
        setMessage(result.message);
        setSent(true);
      } else if (mode === "verify-email") {
        const token = searchParams.get("token");
        if (token) {
          const result = await authApi.verifyEmail(token);
          setMessage(result.message);
        } else {
          const result = await authApi.resendVerification((fd.get("email") as string) ?? "");
          setMessage(result.message);
        }
        setSent(true);
      } else if (mode === "signup") {
        const result = await signup(
          (fd.get("name") as string) ?? "",
          (fd.get("email") as string) ?? "",
          (fd.get("password") as string) ?? "",
        );
        setMessage(result);
        setSent(true);
      } else if (mode === "reset-password") {
        const token = searchParams.get("token");
        const password = (fd.get("password") as string) ?? "";
        const confirm = (fd.get("confirmPassword") as string) ?? "";
        if (!token) throw new Error("Reset link is missing a token.");
        if (password !== confirm) throw new Error("Passwords do not match.");
        const result = await authApi.resetPassword(token, password);
        setMessage(result.message);
        setSent(true);
      } else {
        await login(
          (fd.get("email") as string) ?? "",
          (fd.get("password") as string) ?? "",
        );
        navigate(returnTo ?? "/app/radar");
      }
    } catch (err) {
      setError(err instanceof ApiError || err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-md px-5 sm:px-8 py-16 lg:py-24">
      <div className="text-center">
        <Link to="/" aria-label="RoleBrief home" className="inline-block">
          <Wordmark size="lg" />
        </Link>
      </div>

      <div className="mt-10 rounded-[var(--radius-feature)] border border-line bg-white shadow-[var(--shadow-raised)] p-7 sm:p-8">
        <Kicker className="mb-2">{c.kicker}</Kicker>
        <h1 className="text-2xl font-semibold text-ink">{c.title}</h1>
        <p className="text-slate mt-1.5 text-[15px]">{c.sub}</p>
        {error && <p className="mt-4 rounded-[var(--radius-card)] border border-red/30 bg-red-tint px-3 py-2 text-[13px] text-red" role="alert">{error}</p>}

        {sent ? (
          <div className="mt-6">
            <div className="flex items-center gap-3 rounded-[var(--radius-card)] bg-emerald-tint border border-emerald/30 p-4">
              <CheckCircle2 className="text-emerald shrink-0" size={20} />
              <p className="text-[14px] text-ink">{message || "Request complete. Check your inbox for next steps."}</p>
            </div>
            <p className="text-center text-[13px] text-slate mt-4">
              <Link to="/login" className="text-indigo font-medium">Return to login</Link>
            </p>
          </div>
        ) : (
          <form onSubmit={submit} className="mt-6 space-y-4">
            {mode === "signup" && (
              <Input label="Name" name="name" type="text" placeholder="Your name" leading={<User size={16} />} autoComplete="name" required />
            )}
            {(mode !== "reset-password" && !(mode === "verify-email" && searchParams.get("token"))) && (
              <Input label="Email" name="email" type="email" placeholder="you@example.com" leading={<Mail size={16} />} autoComplete="email" required />
            )}
            {(mode === "login" || mode === "signup" || mode === "reset-password") && (
              <Input
                label={mode === "reset-password" ? "New password" : "Password"}
                name="password"
                type="password"
                placeholder="••••••••••"
                leading={<Lock size={16} />}
                autoComplete={mode === "login" ? "current-password" : "new-password"}
                hint={mode === "login" ? undefined : "12+ characters"}
                required
              />
            )}
            {mode === "reset-password" && (
              <Input label="Confirm new password" name="confirmPassword" type="password" placeholder="••••••••••" leading={<Lock size={16} />} required />
            )}

            {mode === "login" && (
              <div className="flex justify-end -mt-1">
                <Link to="/forgot-password" className="text-[13px] text-indigo font-medium">
                  Forgot password?
                </Link>
              </div>
            )}

            <Button type="submit" className="w-full" size="lg" loading={loading} icon={<ArrowRight size={18} />}>
              {c.cta}
            </Button>
          </form>
        )}
      </div>

      <p className="text-center text-[14px] text-slate mt-6">
        {mode === "login" ? (
          <>New to RoleBrief? <Link to="/signup" className="text-indigo font-medium">Create an account</Link></>
        ) : (
          <>Already have an account? <Link to="/login" className="text-indigo font-medium">Log in</Link></>
        )}
      </p>
    </div>
  );
}
