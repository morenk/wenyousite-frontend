/** 子贴切换器：在主题帖排头卡内用目录菜单承载大量子贴。 */

"use client";

import { Menu } from "@base-ui/react/menu";
import { Check, ChevronDown, ChevronLeft, ChevronRight, ListTree } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { SubthreadDetail } from "@/api/hooks/use-thread-detail";

interface SubthreadSwitcherProps {
  subthreads: SubthreadDetail[];
  selectedId: string | undefined;
  onChange: (id: string) => void;
  className?: string;
}

/**
 * 文件名保留历史路径以降低调用方迁移成本；组件本身不再渲染横向 Tabs。
 */
export function SubthreadSwitcher({
  subthreads,
  selectedId,
  onChange,
  className,
}: SubthreadSwitcherProps) {
  const selected = subthreads.find((subthread) => subthread.id === selectedId)
    ?? subthreads[0];

  if (subthreads.length <= 1 || !selected) return null;
  const selectedIndex = subthreads.findIndex((subthread) => subthread.id === selected.id);
  const previous = subthreads[selectedIndex - 1];
  const next = subthreads[selectedIndex + 1];

  return (
    <div
      data-slot="subthread-switcher"
      role="group"
      aria-label="子贴切换"
      className={cn("flex min-w-0 items-center gap-1", className)}
    >
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        className="rounded-lg text-muted-foreground hover:text-foreground"
        aria-label={previous ? `上一个子贴：${previous.title}` : "已经是第一个子贴"}
        title={previous ? `上一个子贴：${previous.title}` : "已经是第一个子贴"}
        disabled={!previous}
        onClick={() => previous && onChange(previous.id)}
      >
        <ChevronLeft className="size-4" aria-hidden="true" />
      </Button>

      <Menu.Root>
        <Menu.Trigger
          render={
            <Button
              type="button"
              variant="outline"
              size="compact"
              className="group h-9 w-0 min-w-0 grow justify-start gap-2 rounded-xl bg-card px-3 font-normal shadow-none"
              aria-label={`切换子贴，当前：${selected.title}`}
            />
          }
        >
          <ListTree className="size-4 text-brand-strong" aria-hidden="true" />
          <span className="min-w-0 flex-1 truncate text-left font-display text-sm font-bold text-foreground">
            {selected.title}
          </span>
          <span className="shrink-0 font-utility text-xs tabular-nums text-muted-foreground">
            {selected._count.posts} 楼
          </span>
          <ChevronDown
            className="ml-auto size-4 text-muted-foreground transition-transform group-aria-expanded:rotate-180"
            aria-hidden="true"
          />
        </Menu.Trigger>

        <Menu.Portal>
          <Menu.Positioner side="bottom" align="start" sideOffset={6} className="z-[70]">
            <Menu.Popup
              aria-label="切换子贴"
              className="w-[min(22rem,calc(100vw-2rem))] origin-(--transform-origin) overflow-hidden rounded-xl border border-border bg-popover text-popover-foreground shadow-popover outline-none duration-[var(--motion-standard)] data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95"
            >
              <div className="flex items-center justify-between border-b border-border px-3.5 py-2.5">
                <p className="font-display text-sm font-bold">主题目录</p>
                <span className="font-utility text-xs text-muted-foreground">
                  共 {subthreads.length} 个子贴
                </span>
              </div>
              <div className="max-h-80 overflow-y-auto overscroll-contain p-1.5">
                {subthreads.map((subthread) => {
                  const isSelected = subthread.id === selected.id;
                  return (
                    <Menu.Item
                      key={subthread.id}
                      aria-current={isSelected ? "page" : undefined}
                      className={cn(
                        "grid min-h-11 w-full cursor-default grid-cols-[1rem_minmax(0,1fr)_auto] items-center gap-2 rounded-lg px-2.5 py-2 outline-none select-none data-highlighted:bg-accent/70 data-highlighted:text-accent-foreground focus:bg-accent/70",
                        isSelected && "bg-accent text-accent-foreground",
                      )}
                      onClick={() => onChange(subthread.id)}
                    >
                      <Check
                        className={cn(
                          "size-4 text-brand-strong",
                          !isSelected && "opacity-0",
                        )}
                        aria-hidden="true"
                      />
                      <span className="min-w-0 truncate text-sm font-medium">
                        {subthread.title}
                      </span>
                      <span className="font-utility text-xs tabular-nums text-muted-foreground">
                        {subthread._count.posts} 楼
                      </span>
                    </Menu.Item>
                  );
                })}
              </div>
            </Menu.Popup>
          </Menu.Positioner>
        </Menu.Portal>
      </Menu.Root>

      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        className="rounded-lg text-muted-foreground hover:text-foreground"
        aria-label={next ? `下一个子贴：${next.title}` : "已经是最后一个子贴"}
        title={next ? `下一个子贴：${next.title}` : "已经是最后一个子贴"}
        disabled={!next}
        onClick={() => next && onChange(next.id)}
      >
        <ChevronRight className="size-4" aria-hidden="true" />
      </Button>
    </div>
  );
}
