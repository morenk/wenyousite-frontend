"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { trackNavigationHistory } from "@/lib/navigation-history";

/** 公共离页保护；业务回调保留保存、编辑器 flush 和版本复核语义。 */
export function useNavigationGuard({ dirty, busy, confirmLeave }: {
  dirty: boolean;
  busy: boolean;
  confirmLeave: () => Promise<boolean>;
}) {
  const router = useRouter();
  const latest = useRef({ dirty, busy, confirmLeave });
  useEffect(() => { latest.current = { dirty, busy, confirmLeave }; }, [dirty, busy, confirmLeave]);
  useEffect(() => {
    let active = true;
    let allowed = false;
    let asking = false;
    const tracker = trackNavigationHistory();
    const guarded = () => !allowed && (latest.current.dirty || latest.current.busy);
    const requestLeave = async (leave: () => void) => {
      if (!active || latest.current.busy || asking) return;
      asking = true;
      try {
        const accepted = !latest.current.dirty || await latest.current.confirmLeave();
        if (active && accepted && !latest.current.busy) {
          leave();
        }
      } finally { asking = false; }
    };
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (!guarded()) return;
      event.preventDefault();
      event.returnValue = "";
    };
    const click = (event: MouseEvent) => {
      if (!guarded() || event.defaultPrevented || event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
      const anchor = event.target instanceof Element ? event.target.closest<HTMLAnchorElement>("a[href]") : null;
      if (!anchor || (anchor.target && anchor.target !== "_self") || anchor.hasAttribute("download")) return;
      const destination = new URL(anchor.href, location.href);
      if (!['http:', 'https:'].includes(destination.protocol)) return;
      if (destination.pathname === location.pathname && destination.search === location.search && destination.origin === location.origin) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      void requestLeave(() => {
        if (destination.origin === location.origin) router.push(destination.href);
        else { allowed = true; location.assign(destination.href); }
      });
    };
    const removeBlocker = tracker.addBlocker({ isBlocked: guarded, request: (replay) => { void requestLeave(replay); } });
    window.addEventListener("beforeunload", beforeUnload);
    document.addEventListener("click", click, true);
    return () => {
      active = false;
      removeBlocker?.();
      window.removeEventListener("beforeunload", beforeUnload);
      document.removeEventListener("click", click, true);
    };
  }, [router]);
}
