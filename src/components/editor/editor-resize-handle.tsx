"use client";

import { GripHorizontal } from "lucide-react";
import { useRef, useState, type RefObject } from "react";

/** 只改变正文视口，不重建编辑器，保留选区、输入法与撤销历史。 */
export function EditorResizeHandle({ containerRef, minHeight, maxHeight, disabled }: {
  containerRef: RefObject<HTMLDivElement | null>;
  minHeight: number;
  maxHeight: number;
  disabled?: boolean;
}) {
  const [height, setHeight] = useState<number | null>(null);
  const drag = useRef<{ y: number; height: number; pointerId: number } | null>(null);
  const limit = Math.max(maxHeight, 1200);
  const currentHeight = () => containerRef.current?.querySelector(".ProseMirror")?.getBoundingClientRect().height || height || minHeight;
  const resize = (next: number) => {
    const value = Math.round(Math.min(limit, Math.max(minHeight, next)));
    containerRef.current?.style.setProperty("--editor-user-height", `${value}px`);
    setHeight(value);
  };

  return <div
    role="separator"
    aria-label="调整编辑器高度"
    aria-orientation="horizontal"
    aria-valuemin={minHeight}
    aria-valuemax={limit}
    aria-valuenow={height ?? minHeight}
    aria-disabled={disabled || undefined}
    tabIndex={disabled ? -1 : 0}
    className="flex h-8 w-8 shrink-0 touch-none cursor-ns-resize items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
    onPointerDown={(event) => {
      if (disabled || event.button !== 0) return;
      event.preventDefault();
      drag.current = { y: event.clientY, height: currentHeight(), pointerId: event.pointerId };
      event.currentTarget.setPointerCapture(event.pointerId);
    }}
    onPointerMove={(event) => {
      if (disabled || drag.current?.pointerId !== event.pointerId) return;
      resize(drag.current.height + event.clientY - drag.current.y);
    }}
    onPointerUp={(event) => {
      if (drag.current?.pointerId !== event.pointerId) return;
      drag.current = null;
      event.currentTarget.releasePointerCapture(event.pointerId);
    }}
    onLostPointerCapture={() => { drag.current = null; }}
    onPointerCancel={() => { drag.current = null; }}
    onKeyDown={(event) => {
      if (disabled) return;
      const next = event.key === "ArrowDown" ? currentHeight() + 40
        : event.key === "ArrowUp" ? currentHeight() - 40
          : event.key === "Home" ? minHeight : event.key === "End" ? limit : null;
      if (next === null) return;
      event.preventDefault();
      resize(next);
    }}
  ><GripHorizontal aria-hidden="true" className="h-4 w-4 text-muted-foreground" /></div>;
}
