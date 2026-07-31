/** 子贴 Tab 切换组件 */

"use client";

import { cn } from "@/lib/utils";
import type { SubthreadDetail } from "@/api/hooks/use-thread-detail";

interface SubthreadTabsProps {
  subthreads: SubthreadDetail[];
  selectedId: string | undefined;
  onChange: (id: string) => void;
}

export function SubthreadTabs({
  subthreads,
  selectedId,
  onChange,
}: SubthreadTabsProps) {
  if (subthreads.length <= 1) return null;

  return (
    <div className="flex gap-1 overflow-x-auto border-b border-border">
      {subthreads.map((sub) => (
        <button
          key={sub.id}
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
        </button>
      ))}
    </div>
  );
}
