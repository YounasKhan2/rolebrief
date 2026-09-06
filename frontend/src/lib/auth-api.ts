import { API_BASE_URL, ApiError } from "./api";

export type AuthRole = "USER" | "ADMIN";
export type AuthStatus = "PENDING_VERIFICATION" | "ACTIVE" | "LOCKED" | "DISABLED";

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  initials: string;
  role: AuthRole;
  status: AuthStatus;
  isAdmin: boolean;
}

export interface AuthSession {
  id: string;
  createdAt: string;
  lastUsedAt: string;
  expiresAt: string;
  userAgent: string | null;
}

const DEFAULT_TIMEOUT_MS = 8000;

function csrfToken() {
  if (typeof document === "undefined") return undefined;
  return document.cookie
    .split("; ")
    .find((part) => part.startsWith("rb_csrf="))
    ?.split("=")[1];
}

let inFlightRefreshPromise: Promise<{ user: AuthUser }> | null = null;

export function getInFlightRefreshPromise(): Promise<{ user: AuthUser }> | null {
  return inFlightRefreshPromise;
}

export function resetRefreshMutexForTesting(): void {
  inFlightRefreshPromise = null;
}

export function refresh(): Promise<{ user: AuthUser }> {
  if (inFlightRefreshPromise) {
    return inFlightRefreshPromise;
  }

  inFlightRefreshPromise = authRequest<{ user: AuthUser }>(
    "/auth/refresh",
    { method: "POST" },
    true
  ).finally(() => {
    inFlightRefreshPromise = null;
  });

  return inFlightRefreshPromise;
}

async function authRequest<T>(
  path: string,
  options: { method?: string; body?: unknown; csrf?: boolean } = {},
  retried = false
): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort("timeout"), DEFAULT_TIMEOUT_MS);
  const headers: Record<string, string> = { Accept: "application/json" };
  if (options.body) headers["Content-Type"] = "application/json";
  if (options.csrf) {
    const token = csrfToken();
    if (token) headers["x-rolebrief-csrf"] = decodeURIComponent(token);
  }

  try {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      method: options.method ?? "GET",
      headers,
      body: options.body ? JSON.stringify(options.body) : undefined,
      credentials: "include",
      signal: controller.signal
    });

    // Handle 401 with unified refresh mutex: never refresh on refresh/login/logout or if already retried
    if (
      response.status === 401 &&
      !retried &&
      path !== "/auth/refresh" &&
      path !== "/auth/login" &&
      path !== "/auth/logout"
    ) {
      try {
        await refresh();
        return await authRequest<T>(path, options, true);
      } catch {
        throw new ApiError("Session expired. Please log in again.", "http", 401);
      }
    }

    if (!response.ok) {
      const message = await response.json().then((body) => body.message).catch(() => undefined);
      throw new ApiError(Array.isArray(message) ? message.join(" ") : message ?? `Auth API returned ${response.status}.`, "http", response.status);
    }
    return (await response.json()) as T;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    if (controller.signal.aborted) throw new ApiError("The auth request timed out.", "timeout");
    throw new ApiError("Could not reach the auth API.", "network");
  } finally {
    clearTimeout(timeout);
  }
}

export function signup(name: string, email: string, password: string) {
  return authRequest<{ message: string }>("/auth/signup", { method: "POST", body: { name, email, password } });
}

export function login(email: string, password: string) {
  return authRequest<{ user: AuthUser }>("/auth/login", { method: "POST", body: { email, password } });
}

export function me() {
  return authRequest<{ user: AuthUser }>("/auth/me");
}

export function logout() {
  return authRequest<{ message: string }>("/auth/logout", { method: "POST", csrf: true });
}

export function verifyEmail(token: string) {
  return authRequest<{ message: string }>("/auth/verify-email", { method: "POST", body: { token } });
}

export function resendVerification(email: string) {
  return authRequest<{ message: string }>("/auth/resend-verification", { method: "POST", body: { email } });
}

export function forgotPassword(email: string) {
  return authRequest<{ message: string }>("/auth/forgot-password", { method: "POST", body: { email } });
}

export function resetPassword(token: string, password: string) {
  return authRequest<{ message: string }>("/auth/reset-password", { method: "POST", body: { token, password } });
}

export function changePassword(currentPassword: string, newPassword: string) {
  return authRequest<{ message: string }>("/auth/change-password", { method: "POST", body: { currentPassword, newPassword }, csrf: true });
}

export function sessions() {
  return authRequest<{ sessions: AuthSession[] }>("/auth/sessions");
}

export function revokeSession(sessionId: string) {
  return authRequest<{ message: string }>(`/auth/sessions/${encodeURIComponent(sessionId)}`, { method: "DELETE", csrf: true });
}

export function logoutAll() {
  return authRequest<{ message: string }>("/auth/logout-all", { method: "POST", csrf: true });
}

export interface AdminUser {
  id: string;
  name: string;
  email: string;
  role: AuthRole;
  status: AuthStatus;
  emailVerifiedAt: string | null;
  createdAt: string;
  updatedAt: string;
  lastLoginAt: string | null;
}

export function listAdminUsers() {
  return authRequest<{ users: AdminUser[] }>("/admin/users");
}

export function updateAdminUserStatus(id: string, status: AuthStatus) {
  return authRequest<{ user: AdminUser }>(`/admin/users/${encodeURIComponent(id)}/status`, { method: "PATCH", body: { status }, csrf: true });
}

export function updateAdminUserRole(id: string, role: AuthRole) {
  return authRequest<{ user: AdminUser }>(`/admin/users/${encodeURIComponent(id)}/role`, { method: "PATCH", body: { role }, csrf: true });
}
