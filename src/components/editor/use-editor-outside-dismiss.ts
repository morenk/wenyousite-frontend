"use client";

import { useEffect, useRef, type MouseEvent as ReactMouseEvent } from "react";

/** React 捕获事件也覆盖 Portal；点击完成后才收起，避免按下时布局移动吞掉外部按钮的点击。 */
export function useEditorOutsideDismiss(dismiss: () => Promise<unknown>, disabled: boolean) {
  const insideClick = useRef<Event | null>(null);
  const pointerStartedInside = useRef(false);
  const closing = useRef(false);
  useEffect(() => {
    let active = true;
    const resetPointer = () => { pointerStartedInside.current = false; };
    const onClick = (event: MouseEvent) => {
      if (disabled || event.button !== 0 || insideClick.current === event
        || (event.detail > 0 && pointerStartedInside.current)) return;
      queueMicrotask(() => {
        if (!active || closing.current || event.defaultPrevented) return;
        // 外部入口可能已启动自己的确认流程，交由该流程处理，避免重复确认。
        if (document.querySelector('[role="alertdialog"], [role="dialog"][aria-modal="true"]')) return;
        closing.current = true;
        void dismiss().finally(() => { closing.current = false; });
      });
    };
    document.addEventListener("pointerdown", resetPointer, true);
    document.addEventListener("click", onClick);
    return () => {
      active = false;
      document.removeEventListener("pointerdown", resetPointer, true);
      document.removeEventListener("click", onClick);
    };
  }, [dismiss, disabled]);
  return {
    onPointerDownCapture: () => { pointerStartedInside.current = true; },
    onClickCapture: (event: ReactMouseEvent) => { insideClick.current = event.nativeEvent; },
  };
}
