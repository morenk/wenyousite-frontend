"use client";

import { useEffect } from "react";

const positions = new Map<string, number>();
export function clearAdminListPositions() { positions.clear(); }

export function adminDetailHref(path: string, list: "/station/users" | "/station/content") {
  const current = typeof window === "undefined" ? list : window.location.pathname + window.location.search;
  const returnTo = safeAdminReturnTo(current, list);
  return path + "?returnTo=" + encodeURIComponent(returnTo);
}

export function rememberAdminListPosition() {
  positions.set(window.location.pathname + window.location.search, window.scrollY);
}

export function useAdminListReturn(ready: boolean) {
  useEffect(() => {
    if (!ready) return;
    const key = window.location.pathname + window.location.search;
    const position = positions.get(key);
    if (position === undefined) return;
    const frame = requestAnimationFrame(() => { window.scrollTo(0, position); positions.delete(key); });
    return () => cancelAnimationFrame(frame);
  }, [ready]);
}

export function safeAdminReturnTo(value: string | null, list: "/station/users" | "/station/content") {
  return value === list || value?.startsWith(list + "?") ? value : list;
}
