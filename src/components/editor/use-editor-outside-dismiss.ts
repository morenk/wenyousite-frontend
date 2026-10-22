"use client";

import { useEffect, useRef, type PointerEvent as ReactPointerEvent } from "react";

/** React 捕获事件也覆盖 Portal 菜单，不能只用 DOM contains 判断编辑器内外。 */
export function useEditorOutsideDismiss(dismiss: () => Promise<unknown>, disabled: boolean) {
  const insideEvent = useRef<Event | null>(null);
  const closing = useRef(false);
  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      if (disabled || closing.current || event.button !== 0 || insideEvent.current === event) return;
      // 确认框由全局 Provider 挂载，交互由确认流程负责。
      if (event.target instanceof Element && event.target.closest('[role="dialog"], [role="alertdialog"]')) return;
      closing.current = true;
      void dismiss().finally(() => { closing.current = false; });
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [dismiss, disabled]);
  return (event: ReactPointerEvent) => { insideEvent.current = event.nativeEvent; };
}
