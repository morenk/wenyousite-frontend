"use client";

import { useSyncExternalStore, type ComponentProps } from "react";
import { Toaster } from "sonner";

function subscribe(listener: () => void) {
  const viewport = window.visualViewport;
  viewport?.addEventListener("resize", listener);
  viewport?.addEventListener("scroll", listener);
  return () => {
    viewport?.removeEventListener("resize", listener);
    viewport?.removeEventListener("scroll", listener);
  };
}

function getTop() {
  return Math.max(0, window.visualViewport?.offsetTop ?? 0);
}

/** 复用全局横栏提示；键盘平移可视区后仍避开顶部安全区。 */
export function ViewportToaster(props: ComponentProps<typeof Toaster>) {
  const top = useSyncExternalStore(subscribe, getTop, () => 0);
  return <Toaster
    {...props}
    offset={{ top: `calc(${top}px + max(24px, env(safe-area-inset-top, 0px)))` }}
    mobileOffset={{ top: `calc(${top}px + max(16px, env(safe-area-inset-top, 0px)))` }}
  />;
}
