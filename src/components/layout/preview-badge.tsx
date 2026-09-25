"use client";

import { useEffect, useRef, useState } from "react";

export function PreviewBadge({ snapshot }: { snapshot?: string }) {
  const badgeRef = useRef<HTMLElement>(null);
  const [bottom, setBottom] = useState(96);
  useEffect(() => {
    if (!snapshot || !badgeRef.current) return;
    const update = () => {
      const badge = badgeRef.current?.getBoundingClientRect();
      if (!badge) return;
      let clearance = 12;
      for (const dock of document.querySelectorAll<HTMLElement>('[data-slot$="-dock"]')) {
        const rect = dock.getBoundingClientRect();
        if (rect.height > 0 && rect.right > badge.left && rect.left < badge.right) {
          clearance = Math.max(clearance, window.innerHeight - rect.top + 12);
        }
      }
      setBottom((current) => current === clearance ? current : clearance);
    };
    const resize = new ResizeObserver(update);
    const observe = () => {
      resize.disconnect();
      if (badgeRef.current) resize.observe(badgeRef.current);
      document.querySelectorAll('[data-slot$="-dock"]').forEach((dock) => resize.observe(dock));
      update();
    };
    const mutations = new MutationObserver(observe);
    mutations.observe(document.body, { childList: true, subtree: true });
    window.addEventListener("resize", update);
    observe();
    return () => { resize.disconnect(); mutations.disconnect(); window.removeEventListener("resize", update); };
  }, [snapshot]);
  if (!snapshot) return null;
  return (
    <aside ref={badgeRef} aria-label="开发预览环境" style={{ bottom }} className="pointer-events-none fixed right-3 z-[var(--layer-chrome)] rounded-md border border-border bg-background px-3 py-2 text-xs text-muted-foreground shadow-sm">
      开发预览 · 快照 <time dateTime={snapshot}>{new Date(snapshot).toLocaleString("zh-CN", { timeZone: "Asia/Shanghai", hour12: false })}</time>
    </aside>
  );
}
