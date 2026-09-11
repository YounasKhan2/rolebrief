import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import * as api from "./auth-api";
import type { AuthUser } from "./auth-api";
import { ApiError } from "../core/api";
export { SessionError } from "../../screens/auth/components/SessionError";

export type AuthStatus = "loading" | "authenticated" | "unauthenticated" | "error";

export interface AuthState {
  user: AuthUser | null;
  status: AuthStatus;
  isAuthenticated: boolean;
  isAdmin: boolean;
  error: Error | null;
  isLoggingOut: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (name: string, email: string, password: string) => Promise<string>;
  logout: () => Promise<void>;
  logoutAll: () => Promise<void>;
  reload: () => Promise<void>;
  updateOnboardingStatus: (status: api.OnboardingStatus) => void;
}

const AUTH_CHANNEL_NAME = "rolebrief_auth";
const AUTH_STORAGE_KEY = "rb_cross_tab_sync";

function broadcastConfirmedLogout() {
  try {
    if (typeof BroadcastChannel !== "undefined") {
      const channel = new BroadcastChannel(AUTH_CHANNEL_NAME);
      channel.postMessage({ type: "LOGOUT", timestamp: Date.now() });
      channel.close();
    }
  } catch {}
  try {
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify({ type: "LOGOUT", timestamp: Date.now() }));
  } catch {}
}

const AuthContext = createContext<AuthState>({
  user: null,
  status: "loading",
  isAuthenticated: false,
  isAdmin: false,
  error: null,
  isLoggingOut: false,
  login: async () => {},
  signup: async () => "",
  logout: async () => {},
  logoutAll: async () => {},
  reload: async () => {},
  updateOnboardingStatus: () => {},
});

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [authError, setAuthError] = useState<Error | null>(null);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const userRef = useRef<AuthUser | null>(null);
  userRef.current = user;

  const reload = useCallback(async () => {
    setIsLoggingOut(false);
    setStatus("loading");
    setAuthError(null);
    try {
      const result = await api.me();
      setUser(result.user);
      setStatus("authenticated");
      setAuthError(null);
    } catch (err: unknown) {
      const apiErr = err instanceof ApiError ? err : new ApiError("Could not verify session.", "network");

      // Confirmed invalid / revoked / expired session
      if (apiErr.status === 401) {
        setUser(null);
        setStatus("unauthenticated");
        setAuthError(null);
      } else {
        // Temporary transport error (timeout, network drop, 500)
        setAuthError(apiErr);
        if (!userRef.current) {
          // Unresolved initial load: expose retryable error state on protected routes
          setStatus("error");
        } else {
          // In-memory session exists: preserve user to prevent destructive kicks on transient network drops
          setStatus("authenticated");
        }
      }
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  // Listen for confirmed cross-tab logout events
  useEffect(() => {
    let channel: BroadcastChannel | null = null;
    try {
      if (typeof BroadcastChannel !== "undefined") {
        channel = new BroadcastChannel(AUTH_CHANNEL_NAME);
        channel.onmessage = (event) => {
          if (event.data?.type === "LOGOUT") {
            setUser(null);
            setStatus("unauthenticated");
            setAuthError(null);
            api.resetCsrfToken();
          }
        };
      }
    } catch {}

    const handleStorage = (e: StorageEvent) => {
      if (e.key === AUTH_STORAGE_KEY && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue);
          if (parsed?.type === "LOGOUT") {
            setUser(null);
            setStatus("unauthenticated");
            setAuthError(null);
            api.resetCsrfToken();
          }
        } catch {}
      }
    };

    window.addEventListener("storage", handleStorage);

    return () => {
      if (channel) channel.close();
      window.removeEventListener("storage", handleStorage);
    };
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    setIsLoggingOut(false);
    const result = await api.login(email, password);
    setUser(result.user);
    setStatus("authenticated");
    setAuthError(null);
  }, []);

  const signup = useCallback(async (name: string, email: string, password: string) => {
    const result = await api.signup(name, email, password);
    setUser(null);
    setStatus("unauthenticated");
    setAuthError(null);
    return result.message;
  }, []);

  const performLogout = useCallback(async (isAll: boolean) => {
    // 1. Call server endpoint first. Do NOT evict local state before server confirmation.
    if (isAll) {
      await api.logoutAll();
    } else {
      await api.logout();
    }

    // 2. Only on confirmed backend success:
    setIsLoggingOut(true);
    setUser(null);
    setStatus("unauthenticated");
    setAuthError(null);
    api.resetCsrfToken();
    broadcastConfirmedLogout();
  }, []);

  const logout = useCallback(() => performLogout(false), [performLogout]);
  const logoutAll = useCallback(() => performLogout(true), [performLogout]);

  const updateOnboardingStatus = useCallback((onboardingStatus: api.OnboardingStatus) => {
    setUser((prev) => (prev ? { ...prev, onboardingStatus } : null));
  }, []);

  const value = useMemo<AuthState>(() => ({
    user,
    status,
    isAuthenticated: status === "authenticated" && user !== null,
    isAdmin: user?.role === "ADMIN",
    error: authError,
    isLoggingOut,
    login,
    signup,
    logout,
    logoutAll,
    reload,
    updateOnboardingStatus
  }), [authError, isLoggingOut, login, logout, logoutAll, reload, signup, status, updateOnboardingStatus, user]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
