/** 子贴切换器：在主题帖排头卡内用紧凑目录承载大量子贴。 */

"use client";

import { Select } from "@base-ui/react/select";
import { Check, ChevronDown, ChevronLeft, ChevronRight, Link2, ListTree } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Tooltip } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { SubthreadDetail } from "@/api/hooks/use-thread-detail";

interface SubthreadSwitcherProps {
  subthreads: SubthreadDetail[];
  selectedId: string | undefined;
  onChange: (id: string) => void;
  onCopyCurrent?: () => void;
  className?: string;
}

/**
 * 文件名保留历史路径以降低调用方迁移成本；组件本身不再渲染横向 Tabs。
 */
export function SubthreadSwitcher({
  subthreads,
  selectedId,
  onChange,
  onCopyCurrent,
  className,
}: SubthreadSwitcherProps) {
  const [open, setOpen] = useState(false);
  const selectedItemRef = useRef<HTMLDivElement>(null);
  const selected = subthreads.find((subthread) => subthread.id === selectedId)
    ?? subthreads[0];

  useEffect(() => {
    if (!open) return;
    const focusTimer = window.setTimeout(() => selectedItemRef.current?.focus(), 0);
    return () => window.clearTimeout(focusTimer);
  }, [open, selected?.id]);

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
      <Tooltip content={previous ? `上一个子贴：${previous.title}` : "已经是第一个子贴"} disabled={!previous}>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="rounded-lg text-muted-foreground hover:text-foreground"
          aria-label={previous ? `上一个子贴：${previous.title}` : "已经是第一个子贴"}
          title={!previous ? "已经是第一个子贴" : undefined}
          disabled={!previous}
          onClick={() => previous && onChange(previous.id)}
        >
          <ChevronLeft className="size-4" aria-hidden="true" />
        </Button>
      </Tooltip>

      <Select.Root
        open={open}
        value={selected.id}
        onOpenChange={setOpen}
        onValueChange={(id) => {
          if (id && id !== selected.id) onChange(id);
        }}
      >
        <Select.Trigger
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
        </Select.Trigger>

        <Select.Portal>
          <Select.Positioner
            side="bottom"
            align="start"
            sideOffset={6}
            alignItemWithTrigger={false}
            className="z-[var(--layer-popup)]"
          >
            <Select.Popup
              className="w-[min(22rem,calc(100vw-2rem))] origin-(--transform-origin) overflow-hidden rounded-xl border border-border bg-popover text-popover-foreground shadow-popover outline-none duration-[var(--motion-standard)] data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95"
            >
              <div
                data-slot="subthread-menu-header"
                className="flex items-center justify-between border-b border-border px-3.5 py-2.5"
              >
                <p className="font-display text-sm font-bold">主题目录</p>
                <div className="flex items-center gap-1.5">
                  <span className="font-utility text-xs text-muted-foreground">
                    共 {subthreads.length} 个子贴
                  </span>
                  {onCopyCurrent ? (
                    <Tooltip content="复制当前子贴链接">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-compact"
                        aria-label="复制当前子贴链接"
                        onClick={onCopyCurrent}
                        className="text-muted-foreground hover:text-foreground"
                      >
                        <Link2 className="size-4" aria-hidden="true" />
                      </Button>
                    </Tooltip>
                  ) : null}
                </div>
              </div>
              <Select.List
                data-slot="subthread-menu-list"
                aria-label="主题目录"
                className="max-h-80 overflow-y-auto overscroll-contain p-1.5 outline-none"
              >
                {subthreads.map((subthread) => {
                  const isSelected = subthread.id === selected.id;
                  return (
                    <Select.Item
                      key={subthread.id}
                      ref={isSelected ? selectedItemRef : undefined}
                      value={subthread.id}
                      label={subthread.title}
                      aria-current={isSelected ? "page" : undefined}
                      className={cn(
                        "grid min-h-11 w-full cursor-default grid-cols-[1rem_minmax(0,1fr)_auto] items-center gap-2 rounded-lg px-2.5 py-2 outline-none select-none data-highlighted:bg-accent/70 data-highlighted:text-accent-foreground",
                        isSelected && "bg-accent text-accent-foreground",
                      )}
                    >
                      <Check
                        className={cn(
                          "size-4 text-brand-strong",
                          !isSelected && "opacity-0",
                        )}
                        aria-hidden="true"
                      />
                      <Select.ItemText className="min-w-0 truncate text-sm font-medium">
                        {subthread.title}
                      </Select.ItemText>
                      <span className="font-utility text-xs tabular-nums text-muted-foreground">
                        {subthread._count.posts} 楼
                      </span>
                    </Select.Item>
                  );
                })}
              </Select.List>
            </Select.Popup>
          </Select.Positioner>
        </Select.Portal>
      </Select.Root>

      <Tooltip content={next ? `下一个子贴：${next.title}` : "已经是最后一个子贴"} disabled={!next}>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="rounded-lg text-muted-foreground hover:text-foreground"
          aria-label={next ? `下一个子贴：${next.title}` : "已经是最后一个子贴"}
          title={!next ? "已经是最后一个子贴" : undefined}
          disabled={!next}
          onClick={() => next && onChange(next.id)}
        >
          <ChevronRight className="size-4" aria-hidden="true" />
        </Button>
      </Tooltip>
    </div>
  );
}
