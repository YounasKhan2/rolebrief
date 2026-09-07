import React, { createContext, useContext, useState } from "react";
import { Outlet, useNavigate } from "react-router";
import { Check, Loader2, AlertTriangle, LogOut } from "lucide-react";
import { Wordmark } from "../components/rolebrief/Wordmark";
import { logout } from "../lib/auth-api";

export type SaveStatus = "idle" | "saving" | "saved" | "conflict" | "error";

interface OnboardingLayoutContextValue {
  saveStatus: SaveStatus;
  setSaveStatus: (status: SaveStatus) => void;
  statusMessage?: string;
  setStatusMessage: (msg?: string) => void;
}

const OnboardingLayoutContext = createContext<OnboardingLayoutContextValue>({
  saveStatus: "idle",
  setSaveStatus: () => {},
  setStatusMessage: () => {}
});

export function useOnboardingLayout() {
  return useContext(OnboardingLayoutContext);
}

export function OnboardingLayout() {
  const navigate = useNavigate();
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [statusMessage, setStatusMessage] = useState<string | undefined>();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  async function handleLogout() {
    setIsLoggingOut(true);
    try {
      await logout();
    } finally {
      navigate("/login", { replace: true });
    }
  }

  return (
    <OnboardingLayoutContext.Provider value={{ saveStatus, setSaveStatus, statusMessage, setStatusMessage }}>
      <div className="min-h-screen flex flex-col bg-paper paper-grain text-ink font-sans selection:bg-indigo/15">
        {/* Minimal Onboarding Top Bar */}
        <header className="sticky top-0 z-30 border-b border-line/80 bg-paper/90 backdrop-blur-md px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Wordmark />
            <span className="hidden sm:inline-block h-4 w-px bg-line" />
            <span className="hidden sm:inline-block text-[12px] font-mono uppercase tracking-wider text-slate">
              Candidate Onboarding
            </span>
          </div>

          <div className="flex items-center gap-4">
            {/* Live Autosave Indicator */}
            <div className="flex items-center gap-2 text-[13px]">
              {saveStatus === "saving" && (
                <span className="inline-flex items-center gap-1.5 text-slate font-medium">
                  <Loader2 size={13} className="animate-spin text-indigo" />
                  <span>Saving…</span>
                </span>
              )}
              {saveStatus === "saved" && (
                <span className="inline-flex items-center gap-1.5 text-emerald font-medium">
                  <Check size={14} className="stroke-[2.5]" />
                  <span>Saved</span>
                </span>
              )}
              {saveStatus === "conflict" && (
                <span className="inline-flex items-center gap-1.5 text-amber-600 font-medium">
                  <AlertTriangle size={14} />
                  <span>{statusMessage || "Sync conflict — refresh"}</span>
                </span>
              )}
              {saveStatus === "error" && (
                <span className="inline-flex items-center gap-1.5 text-rose-600 font-medium">
                  <AlertTriangle size={14} />
                  <span>Save failed</span>
                </span>
              )}
              {saveStatus === "idle" && (
                <span className="text-slate/80 text-[12px] font-data">
                  Autosaved
                </span>
              )}
            </div>

            <div className="h-4 w-px bg-line" />

            {/* Sign Out Action */}
            <button
              onClick={handleLogout}
              disabled={isLoggingOut}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-slate hover:text-ink transition-colors cursor-pointer disabled:opacity-50"
              title="Sign out of current account"
            >
              <LogOut size={13} />
              <span className="hidden sm:inline">Sign out</span>
            </button>
          </div>
        </header>

        {/* Focused Main Content Container */}
        <main className="flex-1 w-full flex flex-col justify-start">
          <Outlet />
        </main>
      </div>
    </OnboardingLayoutContext.Provider>
  );
}
