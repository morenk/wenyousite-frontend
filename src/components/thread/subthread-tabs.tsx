/** 子贴 Tab 切换组件：横向滚动条 + 溢出箭头 + 选中自动滚入视野 */

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type { SubthreadDetail } from "@/api/hooks/use-thread-detail";

interface SubthreadTabsProps {
  subthreads: SubthreadDetail[];
  selectedId: string | undefined;
  onChange: (id: string) => void;
  /** 每个子贴的新增回复数（key 为子贴 id），>0 时显示徽标 */
  newRepliesMap?: Record<string, number>;
}

/** 判断横向内容是否溢出（供测试与内部使用） */
export function hasOverflow(
  scrollWidth: number,
  clientWidth: number,
  scrollLeft: number,
): { left: boolean; right: boolean } {
  const canScroll = scrollWidth > clientWidth + 1;
  return {
    left: canScroll && scrollLeft > 1,
    right: canScroll && scrollLeft + clientWidth < scrollWidth - 1,
  };
}

export function SubthreadTabs({
  subthreads,
  selectedId,
  onChange,
  newRepliesMap,
}: SubthreadTabsProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const [overflow, setOverflow] = useState({ left: false, right: false });

  const updateOverflow = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setOverflow(hasOverflow(el.scrollWidth, el.clientWidth, el.scrollLeft));
  }, []);

  useEffect(() => {
    updateOverflow();
    const el = scrollRef.current;
    if (!el) return;
    el.addEventListener("scroll", updateOverflow, { passive: true });
    window.addEventListener("resize", updateOverflow);
    return () => {
      el.removeEventListener("scroll", updateOverflow);
      window.removeEventListener("resize", updateOverflow);
    };
  }, [subthreads.length, updateOverflow]);

  // 选中 Tab 变化时滚入视野
  useEffect(() => {
    if (!selectedId) return;
    tabRefs.current[selectedId]?.scrollIntoView({
      behavior: "smooth",
      inline: "nearest",
      block: "nearest",
    });
  }, [selectedId]);

  const scrollByDir = (dir: 1 | -1) => {
    scrollRef.current?.scrollBy({ left: dir * 240, behavior: "smooth" });
  };

  if (subthreads.length <= 1) return null;

  return (
    <div className="flex items-center gap-1">
      {overflow.left && (
        <button
          type="button"
          onClick={() => scrollByDir(-1)}
          title="向左滚动"
          className="shrink-0 rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
      )}
      <div
        ref={scrollRef}
        className="flex flex-1 gap-1 overflow-x-auto border-b border-border"
      >
        {subthreads.map((sub) => (
          <button
            key={sub.id}
            ref={(el) => {
              tabRefs.current[sub.id] = el;
            }}
            onClick={() => onChange(sub.id)}
            className={cn(
              "shrink-0 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors",
              selectedId === sub.id
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {sub.title}
            {sub._count.posts > 0 && (
              <span className="ml-1.5 text-xs text-muted-foreground">
                {sub._count.posts}
              </span>
            )}
            {selectedId !== sub.id && (newRepliesMap?.[sub.id] ?? 0) > 0 && (
              <span className="ml-1.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-medium text-white">
                {newRepliesMap![sub.id]}
              </span>
            )}
          </button>
        ))}
      </div>
      {overflow.right && (
        <button
          type="button"
          onClick={() => scrollByDir(1)}
          title="向右滚动"
          className="shrink-0 rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}
