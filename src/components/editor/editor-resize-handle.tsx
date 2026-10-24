"use client";

import { cn } from "@/lib/utils";
import { useRef, useState, type RefObject } from "react";

/** 只改变正文视口，不重建编辑器，保留选区、输入法与撤销历史。 */
export function EditorResizeHandle({ containerRef, minHeight, maxHeight, disabled, edge = "bottom" }: {
  containerRef: RefObject<HTMLDivElement | null>;
  minHeight: number;
  maxHeight: number;
  disabled?: boolean;
  edge?: "top" | "bottom";
}) {
  const [height, setHeight] = useState<number | null>(null);
  const drag = useRef<{ y: number; height: number; pointerId: number } | null>(null);
  const limit = Math.max(maxHeight, 1200);
  const direction = edge === "top" ? -1 : 1;
  const currentHeight = () => containerRef.current?.querySelector(".ProseMirror")?.getBoundingClientRect().height || height || minHeight;
  const resize = (next: number) => {
    const rect = containerRef.current?.getBoundingClientRect();
    const available = edge === "top" && rect ? rect.bottom - (rect.height - currentHeight()) - 16 : limit;
    const value = Math.round(Math.min(Math.max(minHeight, Math.min(limit, available)), Math.max(minHeight, next)));
    containerRef.current?.style.setProperty("--editor-user-height", `${value}px`);
    setHeight(value);
  };

  return <div
    data-resize-edge={edge}
    role="separator"
    aria-label="调整编辑器高度"
    aria-orientation="horizontal"
    aria-valuemin={minHeight}
    aria-valuemax={limit}
    aria-valuenow={height ?? minHeight}
    aria-disabled={disabled || undefined}
    tabIndex={disabled ? -1 : 0}
    className={cn("absolute inset-x-0 z-[var(--layer-sticky)] h-2 touch-none cursor-ns-resize hover:bg-border/60 focus-visible:bg-border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring", edge === "top" ? "top-0" : "bottom-0")}
    onPointerDown={(event) => {
      if (disabled || event.button !== 0) return;
      event.preventDefault();
      drag.current = { y: event.clientY, height: currentHeight(), pointerId: event.pointerId };
      event.currentTarget.setPointerCapture(event.pointerId);
    }}
    onPointerMove={(event) => {
      if (disabled || drag.current?.pointerId !== event.pointerId) return;
      resize(drag.current.height + direction * (event.clientY - drag.current.y));
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
      const next = event.key === "ArrowDown" ? currentHeight() + direction * 40
        : event.key === "ArrowUp" ? currentHeight() - direction * 40
          : event.key === "Home" ? minHeight : event.key === "End" ? limit : null;
      if (next === null) return;
      event.preventDefault();
      resize(next);
    }}
  />;
}
