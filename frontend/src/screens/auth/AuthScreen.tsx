import { useLocation, Link, useNavigate, Navigate } from "react-router";
import { useState } from "react";
import { Mail, Lock, ArrowRight, CheckCircle2 } from "lucide-react";
import { Wordmark } from "../../components/rolebrief/Wordmark";
import { Button, Kicker, SectionRule } from "../../components/ui/primitives";
import { Input } from "../../components/ui/form";
import { useAuth } from "../../lib/auth";

type Mode = "login" | "signup" | "forgot-password" | "reset-password" | "verify-email";

const copy: Record<Mode, { kicker: string; title: string; sub: string; cta: string }> = {
  login: { kicker: "Welcome back", title: "Log in to RoleBrief", sub: "Pick up your brief where you left it.", cta: "Log in" },
  signup: { kicker: "Get started", title: "Create your account", sub: "Build an opportunity brief in a few minutes.", cta: "Create account" },
  "forgot-password": { kicker: "Account recovery", title: "Reset your password", sub: "We'll email you a secure reset link.", cta: "Send reset link" },
  "reset-password": { kicker: "Account recovery", title: "Choose a new password", sub: "Use at least 10 characters.", cta: "Update password" },
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
  const { isAuthenticated, login, signup } = useAuth();
  const mode = (pathname.replace("/", "") || "login") as Mode;
  const c = copy[mode];
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const returnTo = safeReturnTo(state?.returnTo);

  // Already authenticated — redirect away from auth pages
  if (isAuthenticated && (mode === "login" || mode === "signup")) {
    return <Navigate to={returnTo ?? "/app/radar"} replace />;
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "forgot-password" || mode === "verify-email") {
        await new Promise((r) => setTimeout(r, 600));
        setSent(true);
      } else if (mode === "signup") {
        const form = e.target as HTMLFormElement;
        const fd = new FormData(form);
        await signup(
          (fd.get("name") as string) ?? "",
          (fd.get("email") as string) ?? "",
          (fd.get("password") as string) ?? "",
        );
        navigate("/app/onboarding");
      } else {
        // login or reset-password
        const form = e.target as HTMLFormElement;
        const fd = new FormData(form);
        await login(
          (fd.get("email") as string) ?? "",
          (fd.get("password") as string) ?? "",
        );
        navigate(returnTo ?? "/app/radar");
      }
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

        {mode === "verify-email" ? (
          <div className="mt-6">
            <div className="flex items-center gap-3 rounded-[var(--radius-card)] bg-emerald-tint border border-emerald/30 p-4">
              <CheckCircle2 className="text-emerald shrink-0" size={20} />
              <p className="text-[14px] text-ink">Verification link sent to <span className="font-medium">you@example.com</span>.</p>
            </div>
            <Button className="w-full mt-5" variant="secondary" loading={loading} onClick={() => submit(new Event("submit") as unknown as React.FormEvent)}>
              {sent ? "Sent again" : c.cta}
            </Button>
            <p className="text-center text-[13px] text-slate mt-4">
              Entered the wrong address? <Link to="/signup" className="text-indigo font-medium">Start over</Link>
            </p>
          </div>
        ) : sent ? (
          <div className="mt-6 flex items-center gap-3 rounded-[var(--radius-card)] bg-emerald-tint border border-emerald/30 p-4">
            <CheckCircle2 className="text-emerald shrink-0" size={20} />
            <p className="text-[14px] text-ink">Check your inbox for a reset link. It expires in 30 minutes.</p>
          </div>
        ) : (
          <form onSubmit={submit} className="mt-6 space-y-4">
            {mode === "signup" && <Input label="Full name" name="name" placeholder="Ayesha Khan" autoComplete="name" required />}
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
                hint={mode === "login" ? undefined : "10+ characters"}
                required
              />
            )}
            {mode === "reset-password" && (
              <Input label="Confirm new password" type="password" placeholder="••••••••••" leading={<Lock size={16} />} required />
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

        {(mode === "login" || mode === "signup") && (
          <>
            <div className="my-6 flex items-center gap-3 text-[12px] text-slate">
              <SectionRule className="grow" /> or <SectionRule className="grow" />
            </div>
            <button className="w-full h-11 rounded-[var(--radius-control)] border border-line hover:bg-soft transition-colors inline-flex items-center justify-center gap-2 text-sm font-medium">
              <GoogleG /> Continue with Google
            </button>
          </>
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

function GoogleG() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden>
      <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9 3.6l6.7-6.7C35.6 2.6 30.2 0 24 0 14.6 0 6.4 5.4 2.5 13.3l7.9 6.1C12.2 13.7 17.6 9.5 24 9.5Z" />
      <path fill="#4285F4" d="M46.1 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.4c-.5 2.9-2.1 5.3-4.6 7l7.1 5.5c4.1-3.8 6.5-9.4 6.5-16Z" />
      <path fill="#FBBC05" d="M10.4 28.6a14.5 14.5 0 0 1 0-9.2l-7.9-6.1a24 24 0 0 0 0 21.4l7.9-6.1Z" />
      <path fill="#34A853" d="M24 48c6.2 0 11.4-2 15.2-5.5l-7.1-5.5c-2 1.3-4.6 2.1-8.1 2.1-6.4 0-11.8-4.2-13.6-9.9l-7.9 6.1C6.4 42.6 14.6 48 24 48Z" />
    </svg>
  );
}
