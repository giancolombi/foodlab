// Lightweight fetch wrapper. Same-origin in prod (/api), proxied in dev.
const TOKEN_KEY = "foodlab_token";

/**
 * Dispatched whenever the server rejects our token (401/403). AuthContext
 * listens for this and clears the in-memory user so the UI flips back to
 * a signed-out state without needing a page reload.
 */
export const SESSION_EXPIRED_EVENT = "foodlab:session-expired";

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string | null): void {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

interface RequestOptions {
  method?: "GET" | "POST" | "PUT" | "DELETE";
  body?: unknown;
  auth?: boolean;
}

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export async function api<T = any>(
  path: string,
  { method = "GET", body, auth = true }: RequestOptions = {},
): Promise<T> {
  const headers: Record<string, string> = {};
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (auth) {
    const token = getToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  const res = await fetch(`/api${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (res.status === 204) return undefined as T;

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    // Token expired or revoked mid-session. Drop the token and let
    // AuthContext flip the UI back to signed-out so the user isn't
    // left clicking through endless error toasts.
    if (auth && (res.status === 401 || res.status === 403) && getToken()) {
      setToken(null);
      window.dispatchEvent(new CustomEvent(SESSION_EXPIRED_EVENT));
    }
    throw new ApiError(data?.error ?? `Request failed (${res.status})`, res.status);
  }
  return data as T;
}
