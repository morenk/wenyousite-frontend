/** 浏览器认证内存仓库：access token 永不写入持久化 Web Storage。 */

export interface AuthUser {
  id: string;
  email: string;
  username: string;
  avatar: string | null;
  role: string;
  emailVerified: boolean;
}

export interface AuthSnapshot {
  user: AuthUser | null;
  accessToken: string | null;
}

export const AUTH_SESSION_MARKER_KEY = "wenyousite-auth-session";

const serverSnapshot: AuthSnapshot = { user: null, accessToken: null };
let snapshot: AuthSnapshot = serverSnapshot;
const listeners = new Set<() => void>();

function emitChange() {
  for (const listener of listeners) listener();
}

function writeSessionMarker(userId: string) {
  if (typeof window === "undefined") return;
  localStorage.setItem(
    AUTH_SESSION_MARKER_KEY,
    JSON.stringify({ userId, revision: crypto.randomUUID() }),
  );
}

export function readSessionMarkerUserId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const value = localStorage.getItem(AUTH_SESSION_MARKER_KEY);
    if (!value) return null;
    const marker = JSON.parse(value) as { userId?: unknown };
    return typeof marker.userId === "string" ? marker.userId : null;
  } catch {
    localStorage.removeItem(AUTH_SESSION_MARKER_KEY);
    return null;
  }
}

export function getAuthSnapshot(): AuthSnapshot {
  return snapshot;
}

export function getServerAuthSnapshot(): AuthSnapshot {
  return serverSnapshot;
}

export function subscribeAuthStore(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function setAuthSession(
  user: AuthUser,
  accessToken: string,
  options: { announce?: boolean } = {},
) {
  snapshot = { user, accessToken };
  const markerUserId = readSessionMarkerUserId();
  if (options.announce !== false || markerUserId !== user.id) {
    writeSessionMarker(user.id);
  }
  emitChange();
}

export function clearAuthSession(options: { announce?: boolean } = {}) {
  snapshot = serverSnapshot;
  if (options.announce !== false && typeof window !== "undefined") {
    localStorage.removeItem(AUTH_SESSION_MARKER_KEY);
  }
  emitChange();
}

export function getAuthAccessToken(): string | null {
  return snapshot.accessToken;
}

export function getKnownUserId(): string | null {
  return readSessionMarkerUserId() ?? snapshot.user?.id ?? null;
}

export function isAuthUser(value: unknown): value is AuthUser {
  if (typeof value !== "object" || value === null) return false;
  const user = value as Record<string, unknown>;
  return (
    typeof user.id === "string" &&
    typeof user.email === "string" &&
    typeof user.username === "string" &&
    (typeof user.avatar === "string" || user.avatar === null) &&
    typeof user.role === "string" &&
    typeof user.emailVerified === "boolean"
  );
}
