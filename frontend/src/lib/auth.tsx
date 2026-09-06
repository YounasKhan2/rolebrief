import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import * as api from "./auth-api";
import type { AuthUser } from "./auth-api";
import { ApiError } from "./api";
export { SessionError } from "../components/auth/SessionError";

export type AuthStatus = "loading" | "authenticated" | "unauthenticated" | "error";

export interface AuthState {
  user: AuthUser | null;
  status: AuthStatus;
  isAuthenticated: boolean;
  isAdmin: boolean;
  error: Error | null;
  login: (email: string, password: string) => Promise<void>;
  signup: (name: string, email: string, password: string) => Promise<string>;
  logout: () => Promise<void>;
  reload: () => Promise<void>;
}

const AuthContext = createContext<AuthState>({
  user: null,
  status: "loading",
  isAuthenticated: false,
  isAdmin: false,
  error: null,
  login: async () => {},
  signup: async () => "",
  logout: async () => {},
  reload: async () => {},
});

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [authError, setAuthError] = useState<Error | null>(null);
  const userRef = useRef<AuthUser | null>(null);
  userRef.current = user;

  const reload = useCallback(async () => {
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

  const login = useCallback(async (email: string, password: string) => {
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

  const logout = useCallback(async () => {
    await api.logout().catch(() => undefined);
    setUser(null);
    setStatus("unauthenticated");
    setAuthError(null);
  }, []);

  const value = useMemo<AuthState>(() => ({
    user,
    status,
    isAuthenticated: status === "authenticated" && user !== null,
    isAdmin: user?.role === "ADMIN",
    error: authError,
    login,
    signup,
    logout,
    reload
  }), [authError, login, logout, reload, signup, status, user]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
