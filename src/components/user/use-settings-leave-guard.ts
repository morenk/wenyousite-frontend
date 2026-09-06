"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useConfirm } from "@/components/ui/confirm-provider";

// DOM 类型尚未覆盖 Navigation；仅声明浏览器已提供的历史导航能力。
type HistoryNavigation = EventTarget & {
  traverseTo: (key: string) => { finished: Promise<unknown> };
};
type HistoryNavigateEvent = Event & {
  navigationType: string;
  hashChange: boolean;
  destination: { key: string };
};

/** 设置分区离页确认；历史遍历在 URL 与 React 页面切换前取消。 */
export function useSettingsLeaveGuard(dirty: boolean, busy: boolean) {
  const confirm = useConfirm();
  const router = useRouter();
  useEffect(() => {
    if (!dirty && !busy) return;
    let active = true;
    let allowed = false;
    let asking = false;
    const navigation = (window as Window & { navigation?: HistoryNavigation }).navigation;
    const requestLeave = async (leave: () => void) => {
      if (busy || asking) return;
      asking = true;
      const accepted = await confirm({ title: "放弃未保存修改", description: "当前修改尚未保存，确定要放弃吗？", confirmLabel: "放弃修改", cancelLabel: "继续编辑", destructive: true });
      asking = false;
      if (active && accepted) { allowed = true; leave(); }
    };
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (allowed) return;
      event.preventDefault();
      event.returnValue = "";
    };
    const click = (event: MouseEvent) => {
      if (allowed || event.defaultPrevented || event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
      const target = event.target instanceof Element ? event.target.closest<HTMLAnchorElement>("a[href]") : null;
      if (!target || target.target === "_blank" || target.hasAttribute("download")) return;
      const destination = new URL(target.href, window.location.href);
      if (destination.pathname === location.pathname && destination.search === location.search && destination.origin === location.origin) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      void requestLeave(() => {
        if (destination.origin === location.origin) router.push(destination.href);
        else window.location.assign(destination.href);
      });
    };
    const navigate = (event: Event) => {
      const historyEvent = event as HistoryNavigateEvent;
      if (allowed || historyEvent.navigationType !== "traverse" || historyEvent.hashChange || !event.cancelable) return;
      event.preventDefault();
      void requestLeave(() => { void navigation!.traverseTo(historyEvent.destination.key).finished.catch(() => { allowed = false; }); });
    };
    window.addEventListener("beforeunload", beforeUnload);
    document.addEventListener("click", click, true);
    navigation?.addEventListener("navigate", navigate);
    return () => {
      active = false;
      window.removeEventListener("beforeunload", beforeUnload);
      document.removeEventListener("click", click, true);
      navigation?.removeEventListener("navigate", navigate);
    };
  }, [dirty, busy, confirm, router]);
}
