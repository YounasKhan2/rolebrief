import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import * as api from "./auth-api";
import type { AuthUser } from "./auth-api";

type AuthStatus = "loading" | "authenticated" | "unauthenticated" | "error";

interface AuthState {
  user: AuthUser | null;
  status: AuthStatus;
  isAuthenticated: boolean;
  isAdmin: boolean;
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

  const reload = useCallback(async () => {
    setStatus("loading");
    try {
      const result = await api.me();
      setUser(result.user);
      setStatus("authenticated");
    } catch {
      setUser(null);
      setStatus("unauthenticated");
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const login = useCallback(async (email: string, password: string) => {
    const result = await api.login(email, password);
    setUser(result.user);
    setStatus("authenticated");
  }, []);

  const signup = useCallback(async (name: string, email: string, password: string) => {
    const result = await api.signup(name, email, password);
    setUser(null);
    setStatus("unauthenticated");
    return result.message;
  }, []);

  const logout = useCallback(async () => {
    await api.logout().catch(() => undefined);
    setUser(null);
    setStatus("unauthenticated");
  }, []);

  const value = useMemo<AuthState>(() => ({
    user,
    status,
    isAuthenticated: status === "authenticated" && user !== null,
    isAdmin: user?.role === "ADMIN",
    login,
    signup,
    logout,
    reload
  }), [login, logout, reload, signup, status, user]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
