/** 与内容列对齐的通用悬浮输入坞，并按浮层实际高度为列表底部留白。 */

"use client";

import {
  useCallback,
  useLayoutEffect,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";

const DOCK_BOTTOM_OFFSET = 16;

interface DockMetrics {
  left: number;
  width: number;
}

interface FloatingInputDockProps {
  children: ReactNode;
  visible?: boolean;
  layerClassName?: string;
  slotPrefix?: string;
}

export function FloatingInputDock({
  children,
  visible = true,
  layerClassName = "z-[var(--layer-floating)]",
  slotPrefix = "floating-composer",
}: FloatingInputDockProps) {
  const [anchorNode, setAnchorNode] = useState<HTMLDivElement | null>(null);
  const [dockNode, setDockNode] = useState<HTMLDivElement | null>(null);
  const [metrics, setMetrics] = useState<DockMetrics | null>(null);
  const [dockHeight, setDockHeight] = useState(0);

  const updateMetrics = useCallback(() => {
    if (!anchorNode) return;
    const rect = anchorNode.getBoundingClientRect();
    setMetrics((current) => {
      if (current?.left === rect.left && current.width === rect.width) return current;
      return { left: rect.left, width: rect.width };
    });
  }, [anchorNode]);

  const handleAnchorRef = useCallback((node: HTMLDivElement | null) => {
    setAnchorNode(node);
    if (!node) {
      setMetrics(null);
      return;
    }
    const rect = node.getBoundingClientRect();
    setMetrics({ left: rect.left, width: rect.width });
  }, []);

  const handleDockRef = useCallback((node: HTMLDivElement | null) => {
    setDockNode(node);
    setDockHeight(node?.getBoundingClientRect().height ?? 0);
  }, []);

  useLayoutEffect(() => {
    if (!anchorNode) return;
    const observer = new ResizeObserver(updateMetrics);
    observer.observe(anchorNode);
    window.addEventListener("resize", updateMetrics);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", updateMetrics);
    };
  }, [anchorNode, updateMetrics]);

  useLayoutEffect(() => {
    if (!dockNode) return;
    const updateHeight = () => {
      const height = dockNode.getBoundingClientRect().height;
      setDockHeight((current) => current === height ? current : height);
    };
    updateHeight();
    const observer = new ResizeObserver(updateHeight);
    observer.observe(dockNode);
    return () => observer.disconnect();
  }, [dockNode]);

  return (
    <>
      <div
        ref={handleAnchorRef}
        data-slot={`${slotPrefix}-anchor`}
        aria-hidden="true"
        className="w-full"
        style={{
          height: visible && dockHeight > 0
            ? dockHeight + DOCK_BOTTOM_OFFSET
            : 0,
        }}
      />
      {visible && metrics && typeof document !== "undefined" && createPortal(
        <div
          ref={handleDockRef}
          data-slot={`${slotPrefix}-dock`}
          className={cn("pointer-events-none fixed bottom-4", layerClassName)}
          style={{ left: metrics.left, width: metrics.width }}
        >
          <div className="pointer-events-auto rounded-xl shadow-floating">
            {children}
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
