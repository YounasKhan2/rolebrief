import { useLocation, Link, useNavigate, Navigate, useSearchParams } from "react-router";
import { useState, useEffect } from "react";
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

import { sanitizeReturnTo } from "../../lib/routing";

export function Component() {
  const { pathname, state } = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, isAuthenticated, status, login, signup } = useAuth();
  const mode = (pathname.replace("/", "") || "login") as Mode;
  const c = copy[mode];
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [cooldown, setCooldown] = useState(0);

  // Email verification on-mount state machine
  const verifyToken = searchParams.get("token");
  const [verifyState, setVerifyState] = useState<"idle" | "verifying" | "success" | "error">("idle");
  const [verifyMessage, setVerifyMessage] = useState("");

  // Cooldown countdown timer
  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => {
      setCooldown((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  // Auto-verify token on mount if present in verify-email mode
  useEffect(() => {
    if (mode === "verify-email" && verifyToken && verifyState === "idle") {
      setVerifyState("verifying");
      authApi.verifyEmail(verifyToken)
        .then((res) => {
          setVerifyState("success");
          setVerifyMessage(res.message || "Your email has been successfully verified.");
        })
        .catch((err) => {
          setVerifyState("error");
          setVerifyMessage(err instanceof Error ? err.message : "Verification link is invalid or has expired.");
        });
    }
  }, [mode, verifyToken, verifyState]);

  const rawReturnTo = searchParams.get("returnTo") || (state as { returnTo?: string } | null)?.returnTo;
  const returnTo = sanitizeReturnTo(rawReturnTo, user?.role);

  if (status === "loading") {
    return <div className="mx-auto max-w-md px-5 sm:px-8 py-16 lg:py-24 text-center text-slate">Checking your session...</div>;
  }

  // Already authenticated — redirect away from auth pages to sanitized destination
  if (isAuthenticated && (mode === "login" || mode === "signup")) {
    return <Navigate to={returnTo} replace />;
  }

  // Authenticated user navigating to forgot-password: offer direct navigation to settings
  if (isAuthenticated && mode === "forgot-password") {
    return (
      <div className="mx-auto max-w-md px-5 sm:px-8 py-16 lg:py-24 text-center">
        <Link to="/" aria-label="RoleBrief home" className="inline-block mb-6">
          <Wordmark size="lg" />
        </Link>
        <Kicker className="mb-2">Account security</Kicker>
        <h1 className="font-display text-2xl text-navy">Already signed in</h1>
        <p className="mt-3 text-sm text-slate leading-relaxed">
          You are currently signed in as <span className="font-semibold text-ink">{user?.email}</span>. You can change your password directly in your account settings.
        </p>
        <div className="mt-6 flex justify-center gap-3">
          <Button onClick={() => navigate("/app/settings", { replace: true })}>
            Go to Settings
          </Button>
        </div>
      </div>
    );
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
        setMessage(result.message || "If an account exists for this email, we have sent password reset instructions.");
        setSent(true);
      } else if (mode === "verify-email") {
        const result = await authApi.resendVerification((fd.get("email") as string) ?? "");
        setMessage(result.message || "If an unverified account exists, a new verification link has been sent.");
        setSent(true);
        setCooldown(60);
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
        if (!token) throw new Error("Reset link is missing a valid token.");
        if (password.length < 12) throw new Error("Password must be at least 12 characters long.");
        if (password !== confirm) throw new Error("Passwords do not match.");
        const result = await authApi.resetPassword(token, password);
        setMessage(result.message || "Password successfully updated. You can now log in.");
        setSent(true);
      } else {
        await login(
          (fd.get("email") as string) ?? "",
          (fd.get("password") as string) ?? "",
        );
        navigate(returnTo, { replace: true });
      }
    } catch (err) {
      if (err instanceof ApiError && err.status === 429) {
        const seconds = err.retryAfterSeconds ?? 60;
        setCooldown(seconds);
        setError(`Rate limit reached. Please wait ${seconds} seconds before trying again.`);
      } else {
        setError(err instanceof ApiError || err instanceof Error ? err.message : "Something went wrong.");
      }
    } finally {
      setLoading(false);
    }
  }

  // Token verification in progress or completed
  const isDirectVerification = mode === "verify-email" && Boolean(verifyToken);
  const isResetMissingToken = mode === "reset-password" && !searchParams.get("token");

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

        {error && (
          <div className="mt-4 rounded-[var(--radius-card)] border border-red/30 bg-red-tint px-3 py-2 text-[13px] text-red" role="alert" aria-live="assertive">
            {error}
          </div>
        )}

        {/* Direct Token Verification on Mount View */}
        {isDirectVerification ? (
          <div className="mt-6" aria-live="polite">
            {verifyState === "verifying" && (
              <div className="flex flex-col items-center justify-center py-6 text-center">
                <div className="size-8 rounded-full border-2 border-indigo border-t-transparent animate-spin mb-3" />
                <p className="text-[14px] text-slate">Verifying your email address...</p>
              </div>
            )}

            {verifyState === "success" && (
              <div>
                <div className="flex items-start gap-3 rounded-[var(--radius-card)] bg-emerald-tint border border-emerald/30 p-4">
                  <CheckCircle2 className="text-emerald shrink-0 mt-0.5" size={20} />
                  <div>
                    <h2 className="text-[14px] font-semibold text-ink">Email verified</h2>
                    <p className="text-[13px] text-slate mt-0.5">{verifyMessage}</p>
                  </div>
                </div>
                <div className="mt-6">
                  <Button onClick={() => navigate("/login", { replace: true })} className="w-full" size="lg" icon={<ArrowRight size={18} />}>
                    Continue to log in
                  </Button>
                </div>
              </div>
            )}

            {verifyState === "error" && (
              <div>
                <div className="rounded-[var(--radius-card)] border border-red/30 bg-red-tint p-4">
                  <h2 className="text-[14px] font-semibold text-red">Verification link invalid or expired</h2>
                  <p className="text-[13px] text-red/90 mt-1">{verifyMessage}</p>
                </div>
                <p className="text-slate text-[13px] mt-4">
                  You can request a fresh verification link below:
                </p>
                <form onSubmit={submit} className="mt-4 space-y-4">
                  <Input label="Your account email" name="email" type="email" placeholder="you@example.com" leading={<Mail size={16} />} autoComplete="email" required />
                  <Button
                    type="submit"
                    className="w-full"
                    size="lg"
                    loading={loading}
                    disabled={cooldown > 0}
                    icon={<ArrowRight size={18} />}
                  >
                    {cooldown > 0 ? `Resend email (${cooldown}s)` : "Resend verification email"}
                  </Button>
                </form>
              </div>
            )}
          </div>
        ) : isResetMissingToken ? (
          <div className="mt-6">
            <div className="rounded-[var(--radius-card)] border border-amber/30 bg-amber-tint p-4 text-[13px] text-amber">
              <p className="font-semibold">Missing recovery token</p>
              <p className="mt-1">
                This reset link is missing a valid security token. Please use the complete link sent to your email, or request a new reset link.
              </p>
            </div>
            <div className="mt-6">
              <Button onClick={() => navigate("/forgot-password")} className="w-full" size="lg">
                Request new reset link
              </Button>
            </div>
          </div>
        ) : sent ? (
          <div className="mt-6" aria-live="polite">
            <div className="flex items-start gap-3 rounded-[var(--radius-card)] bg-emerald-tint border border-emerald/30 p-4">
              <CheckCircle2 className="text-emerald shrink-0 mt-0.5" size={20} />
              <div>
                <h2 className="text-[14px] font-semibold text-ink">
                  {mode === "reset-password"
                    ? "Password updated"
                    : mode === "forgot-password"
                    ? "Check your inbox"
                    : "Instructions sent"}
                </h2>
                <p className="text-[13px] text-slate mt-1">{message || "Request complete. Check your inbox for next steps."}</p>
              </div>
            </div>
            {mode === "verify-email" && (
              <div className="mt-4 text-center">
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={cooldown > 0}
                  onClick={() => setSent(false)}
                >
                  {cooldown > 0 ? `Send another link (${cooldown}s)` : "Send another link"}
                </Button>
              </div>
            )}
            <p className="text-center text-[13px] text-slate mt-5">
              <Link to="/login" className="text-indigo font-medium hover:underline">Return to login</Link>
            </p>
          </div>
        ) : (
          <form onSubmit={submit} className="mt-6 space-y-4">
            {mode === "signup" && (
              <Input label="Name" name="name" type="text" placeholder="Your name" leading={<User size={16} />} autoComplete="name" required />
            )}
            {mode !== "reset-password" && (
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
              <Input
                label="Confirm new password"
                name="confirmPassword"
                type="password"
                placeholder="••••••••••"
                leading={<Lock size={16} />}
                autoComplete="new-password"
                required
              />
            )}

            {mode === "login" && (
              <div className="flex justify-end -mt-1">
                <Link to="/forgot-password" className="text-[13px] text-indigo font-medium hover:underline">
                  Forgot password?
                </Link>
              </div>
            )}

            <Button
              type="submit"
              className="w-full"
              size="lg"
              loading={loading}
              disabled={mode === "verify-email" && cooldown > 0}
              icon={<ArrowRight size={18} />}
            >
              {mode === "verify-email" && cooldown > 0 ? `Resend email (${cooldown}s)` : c.cta}
            </Button>
          </form>
        )}
      </div>

      <p className="text-center text-[14px] text-slate mt-6">
        {mode === "login" ? (
          <>New to RoleBrief? <Link to="/signup" className="text-indigo font-medium hover:underline">Create an account</Link></>
        ) : (
          <>Already have an account? <Link to="/login" className="text-indigo font-medium hover:underline">Log in</Link></>
        )}
      </p>
    </div>
  );
}
