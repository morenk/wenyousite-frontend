import { previewStorageKey } from "@/lib/preview-session";
import type { AdminSessionData } from "@/api/admin-types";

export type AdminSessionStatus =
  | "checking"
  | "authenticated"
  | "unauthenticated"
  | "unavailable";
export const ADMIN_SESSION_EVENT_KEY = previewStorageKey("wenyousite-admin-session-event");
export interface AdminSessionSnapshot {
  status: AdminSessionStatus;
  data: AdminSessionData | undefined;
  generation: number;
  reason?: "expired" | "logout";
  operation?: "login" | "logout";
}
const initial: AdminSessionSnapshot = {
  status: "checking",
  data: undefined,
  generation: 0,
};
let snapshot = initial;
let csrf: string | null = null;
const listeners = new Set<() => void>();
const resets = new Set<() => void>();
const requests = new Set<AbortController>();
export const getAdminSessionSnapshot = () => snapshot;
export const getServerAdminSessionSnapshot = () => initial;
export const getAdminCsrfToken = () => csrf;
export function setAdminCsrfToken(token: string | null) {
  csrf = token;
}
export function subscribeAdminSession(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
export function registerAdminReset(reset: () => void) {
  resets.add(reset);
  return () => {
    resets.delete(reset);
  };
}
export function registerAdminRequest(controller: AbortController) {
  requests.add(controller);
  return () => {
    requests.delete(controller);
  };
}
function emit() {
  for (const listener of listeners) listener();
}
function reset(
  status: AdminSessionStatus,
  reason?: AdminSessionSnapshot["reason"],
) {
  csrf = null;
  snapshot = {
    status,
    data: undefined,
    generation: snapshot.generation + 1,
    reason,
  };
  // 同步发布不可见状态，再取消并移除查询；迟到响应必须先比较代次。
  emit();
  for (const controller of requests) controller.abort();
  requests.clear();
  for (const callback of resets) callback();
  return snapshot.generation;
}
export function beginAdminSessionChange(operation?: "login" | "logout") {
  const generation = reset("checking");
  snapshot = { ...snapshot, operation };
  emit();
  return generation;
}
export function expireAdminSession(
  generation: number,
  reason: "expired" | "logout" | undefined = snapshot.data
    ? "expired"
    : undefined,
) {
  if (generation !== snapshot.generation) return false;
  const hadSession = Boolean(snapshot.data);
  const finalReason = snapshot.operation === "logout" ? "logout" : reason;
  reset("unauthenticated", finalReason);
  if (hadSession || finalReason === "logout") announceAdminSession();
  return true;
}
export function markAdminChecking() {
  snapshot = { ...snapshot, status: "checking" };
  emit();
  return snapshot.generation;
}
export function markAdminUnavailable(generation: number) {
  if (generation !== snapshot.generation) return;
  snapshot = { ...snapshot, status: "unavailable", operation: undefined };
  emit();
}
export function acceptAdminSession(data: AdminSessionData, generation: number) {
  if (generation !== snapshot.generation) return false;
  if (
    snapshot.data &&
    (snapshot.data.user.id !== data.user.id ||
      snapshot.data.session.id !== data.session.id)
  )
    reset("checking");
  csrf = data.csrfToken;
  snapshot = { status: "authenticated", data, generation: snapshot.generation };
  emit();
  return true;
}
export function updateAdminElevation(
  elevatedUntil: string,
  generation: number,
) {
  if (generation !== snapshot.generation || !snapshot.data) return;
  snapshot = {
    ...snapshot,
    data: {
      ...snapshot.data,
      session: { ...snapshot.data.session, elevatedUntil },
    },
  };
  emit();
}
export function announceAdminSession() {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(ADMIN_SESSION_EVENT_KEY, crypto.randomUUID());
  } catch {
    /* 存储受限不影响当前标签登录。 */
  }
}
