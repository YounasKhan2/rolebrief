import { createContext, useCallback, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";

interface User {
  name: string;
  email: string;
  initials: string;
  isAdmin: boolean;
}

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isAdmin: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (name: string, email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthState>({
  user: null,
  isAuthenticated: false,
  isAdmin: false,
  login: async () => {},
  signup: async () => {},
  logout: () => {},
});

export function useAuth() {
  return useContext(AuthContext);
}

const STORAGE_KEY = "rolebrief_auth";

function loadUser(): User | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as User;
  } catch {
    return null;
  }
}

function persistUser(user: User | null) {
  if (user) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
  } else {
    localStorage.removeItem(STORAGE_KEY);
  }
}

function initialsFrom(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
}

// Prototype admin emails — in production this comes from the backend.
const ADMIN_EMAILS = new Set(["admin@rolebrief.com"]);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(loadUser);

  useEffect(() => {
    persistUser(user);
  }, [user]);

  const login = useCallback(async (email: string, _password: string) => {
    // Simulate async round-trip
    await new Promise((r) => setTimeout(r, 600));
    const name = email.split("@")[0].replace(/[._]/g, " ");
    const u: User = {
      name,
      email,
      initials: initialsFrom(name),
      isAdmin: ADMIN_EMAILS.has(email.toLowerCase()),
    };
    setUser(u);
  }, []);

  const signup = useCallback(async (name: string, email: string, _password: string) => {
    await new Promise((r) => setTimeout(r, 600));
    const u: User = {
      name,
      email,
      initials: initialsFrom(name),
      isAdmin: false,
    };
    setUser(u);
  }, []);

  const logout = useCallback(() => {
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: user !== null,
        isAdmin: user?.isAdmin ?? false,
        login,
        signup,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
