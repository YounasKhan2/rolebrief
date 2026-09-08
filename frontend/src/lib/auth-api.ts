import { API_BASE_URL, ApiError } from "./api";
import { serializeRequestBody } from "./request-body";

export { serializeRequestBody };

export type AuthRole = "USER" | "ADMIN";
export type AuthStatus = "PENDING_VERIFICATION" | "ACTIVE" | "LOCKED" | "DISABLED";
export type OnboardingStatus = "NOT_STARTED" | "IN_PROGRESS" | "COMPLETED" | "SKIPPED";

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  initials: string;
  role: AuthRole;
  status: AuthStatus;
  isAdmin: boolean;
  onboardingStatus?: OnboardingStatus;
}

export interface AuthSession {
  id: string;
  createdAt: string;
  lastUsedAt: string;
  expiresAt: string;
  userAgent: string | null;
}

const DEFAULT_TIMEOUT_MS = 8000;

let inMemoryCsrfToken: string | null = null;

export function getCachedCsrfToken(): string | null {
  return inMemoryCsrfToken;
}

export function setCachedCsrfToken(token: string | null): void {
  inMemoryCsrfToken = token;
}

function csrfToken() {
  if (typeof document === "undefined") return inMemoryCsrfToken ?? undefined;
  const fromCookie = document.cookie
    .split("; ")
    .find((part) => part.startsWith("rb_csrf="))
    ?.split("=")[1];
  return fromCookie ? decodeURIComponent(fromCookie) : (inMemoryCsrfToken ?? undefined);
}

export async function fetchCsrfToken(): Promise<string> {
  try {
    const data = await authRequest<string | { csrf: string }>("/auth/csrf");
    const token = typeof data === "string" ? data : data?.csrf;
    inMemoryCsrfToken = token || "";
    return inMemoryCsrfToken;
  } catch {
    return "";
  }
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

  inFlightRefreshPromise = authRequest<{ user: AuthUser; csrf?: string }>(
    "/auth/refresh",
    { method: "POST" },
    true
  ).then((res) => {
    if (res.csrf) inMemoryCsrfToken = res.csrf;
    return { user: res.user };
  }).finally(() => {
    inFlightRefreshPromise = null;
  });

  return inFlightRefreshPromise;
}

export async function authRequest<T>(
  path: string,
  options: { method?: string; body?: unknown; csrf?: boolean; headers?: Record<string, string> } = {},
  retried = false
): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort("timeout"), DEFAULT_TIMEOUT_MS);
  const initialHeaders: Record<string, string> = { Accept: "application/json", ...options.headers };
  const { body: serializedBody, headers } = serializeRequestBody(options.body, initialHeaders);
  if (options.csrf) {
    let token = csrfToken();
    if (!token && path !== "/auth/csrf") {
      token = await fetchCsrfToken();
    }
    if (token) headers["x-rolebrief-csrf"] = token;
  }

  try {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      method: options.method ?? "GET",
      headers,
      body: serializedBody,
      credentials: "include",
      signal: controller.signal
    });

    // Handle 401 with unified refresh mutex: never refresh on refresh/login/logout or if already retried
    if (
      response.status === 401 &&
      !retried &&
      path !== "/auth/refresh" &&
      path !== "/auth/login" &&
      path !== "/auth/logout" &&
      path !== "/auth/logout-all"
    ) {
      try {
        await refresh();
        return await authRequest<T>(path, options, true);
      } catch {
        throw new ApiError("Session expired. Please log in again.", "http", 401);
      }
    }

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      const message = data?.message;
      const headerRetry = response.headers.get("retry-after");
      const parsedHeader = headerRetry ? parseInt(headerRetry, 10) : undefined;
      const retryAfterSeconds = typeof data?.retryAfterSeconds === "number"
        ? data.retryAfterSeconds
        : (parsedHeader && !isNaN(parsedHeader) ? parsedHeader : undefined);
      const formattedMessage = Array.isArray(message) ? message.join(" ") : message ?? `Auth API returned ${response.status}.`;
      throw new ApiError(formattedMessage, "http", response.status, retryAfterSeconds, data);
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

export async function login(email: string, password: string) {
  const res = await authRequest<{ user: AuthUser; csrf?: string }>("/auth/login", { method: "POST", body: { email, password } });
  if (res.csrf) inMemoryCsrfToken = res.csrf;
  return { user: res.user };
}

export function me() {
  return authRequest<{ user: AuthUser }>("/auth/me");
}

export function resetCsrfToken() {
  inMemoryCsrfToken = null;
}

export async function logout() {
  try {
    return await authRequest<{ message: string }>("/auth/logout", { method: "POST", csrf: true });
  } finally {
    inMemoryCsrfToken = null;
  }
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

export async function logoutAll() {
  try {
    return await authRequest<{ message: string }>("/auth/logout-all", { method: "POST", csrf: true });
  } finally {
    inMemoryCsrfToken = null;
  }
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
