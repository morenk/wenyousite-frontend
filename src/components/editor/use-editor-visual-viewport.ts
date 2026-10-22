"use client";
import { useEffect, useState } from "react";
export interface EditorViewportRect { x: number; y: number; width: number; height: number }
/** 可视区随软键盘动画/平移变化；只更新弹层边界，不改正文滚动或选区。 */
export function useEditorVisualViewport(open: boolean) {
  const [rect, setRect] = useState<EditorViewportRect>();
  useEffect(() => {
    if (!open) return;
    const viewport = window.visualViewport;
    let frame: number | undefined;
    const update = () => {
      frame = undefined;
      const next = { x: viewport?.offsetLeft ?? 0, y: viewport?.offsetTop ?? 0, width: Math.min(viewport?.width ?? innerWidth, document.documentElement.clientWidth || innerWidth), height: viewport?.height ?? innerHeight };
      setRect(previous => previous && Object.keys(next).every(key => previous[key as keyof EditorViewportRect] === next[key as keyof EditorViewportRect]) ? previous : next);
    };
    const schedule = () => { if (frame === undefined) frame = requestAnimationFrame(update); };
    update(); viewport?.addEventListener("resize", schedule); viewport?.addEventListener("scroll", schedule); window.addEventListener("resize", schedule);
    return () => { if (frame !== undefined) cancelAnimationFrame(frame); viewport?.removeEventListener("resize", schedule); viewport?.removeEventListener("scroll", schedule); window.removeEventListener("resize", schedule); };
  }, [open]);
  return rect;
}
