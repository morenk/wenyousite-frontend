/** 子贴切换器：在主题帖排头卡内用可检索目录承载大量子贴。 */

"use client";

import { Combobox } from "@base-ui/react/combobox";
import { Check, ChevronDown, ChevronLeft, ChevronRight, Link2, ListTree, Search } from "lucide-react";
import type { KeyboardEvent as ReactKeyboardEvent } from "react";
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
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [keyboardIndex, setKeyboardIndex] = useState(-1);
  const [activeOptionId, setActiveOptionId] = useState<string>();
  const inputRef = useRef<HTMLInputElement>(null);
  const itemRefs = useRef<Array<HTMLDivElement | null>>([]);
  const selected = subthreads.find((subthread) => subthread.id === selectedId)
    ?? subthreads[0];

  useEffect(() => {
    if (!open) return;
    const focusTimer = window.setTimeout(() => inputRef.current?.focus(), 0);
    return () => window.clearTimeout(focusTimer);
  }, [open]);

  if (subthreads.length <= 1 || !selected) return null;
  const selectedIndex = subthreads.findIndex((subthread) => subthread.id === selected.id);
  const previous = subthreads[selectedIndex - 1];
  const next = subthreads[selectedIndex + 1];
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const filteredSubthreads = normalizedQuery
    ? subthreads.filter((subthread) => (
        subthread.title.toLocaleLowerCase().includes(normalizedQuery)
      ))
    : subthreads;

  function handleInputKeyDown(event: ReactKeyboardEvent<HTMLInputElement>) {
    if (filteredSubthreads.length === 0) return;

    let nextIndex = keyboardIndex;
    if (event.key === "ArrowDown") {
      nextIndex = keyboardIndex < filteredSubthreads.length - 1
        ? keyboardIndex + 1
        : 0;
    } else if (event.key === "ArrowUp") {
      nextIndex = keyboardIndex > 0
        ? keyboardIndex - 1
        : filteredSubthreads.length - 1;
    } else if (event.key === "Home") {
      nextIndex = 0;
    } else if (event.key === "End") {
      nextIndex = filteredSubthreads.length - 1;
    } else if (event.key === "Enter" && keyboardIndex >= 0) {
      event.preventDefault();
      const target = filteredSubthreads[keyboardIndex];
      if (target && target.id !== selected.id) onChange(target.id);
      setOpen(false);
      setActiveOptionId(undefined);
      return;
    } else {
      return;
    }

    event.preventDefault();
    setKeyboardIndex(nextIndex);
    setActiveOptionId(itemRefs.current[nextIndex]?.id);
  }

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

      <Combobox.Root
        items={subthreads}
        open={open}
        autoHighlight
        value={selected}
        inputValue={query}
        onInputValueChange={(value) => {
          setQuery(value);
          setKeyboardIndex(-1);
          setActiveOptionId(undefined);
        }}
        filter={(subthread, value) => (
          subthread.title.toLocaleLowerCase().includes(value.trim().toLocaleLowerCase())
        )}
        itemToStringLabel={(subthread) => subthread.title}
        itemToStringValue={(subthread) => subthread.id}
        isItemEqualToValue={(item, value) => item.id === value.id}
        onOpenChange={(open) => {
          setOpen(open);
          setKeyboardIndex(-1);
          setActiveOptionId(undefined);
          if (!open) setQuery("");
        }}
        onValueChange={(subthread) => {
          if (subthread && subthread.id !== selected.id) onChange(subthread.id);
        }}
      >
        <Combobox.Trigger
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
        </Combobox.Trigger>

        <Combobox.Portal>
          <Combobox.Positioner side="bottom" align="start" sideOffset={6} className="z-[70]">
            <Combobox.Popup
              aria-label="主题目录"
              initialFocus={inputRef}
              className="w-[min(22rem,calc(100vw-2rem))] origin-(--transform-origin) overflow-hidden rounded-xl border border-border bg-popover text-popover-foreground shadow-popover outline-none duration-[var(--motion-standard)] data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95"
            >
              <div className="flex items-center justify-between border-b border-border px-3.5 py-2.5">
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
              <div className="border-b border-border p-2.5">
                <label className="flex h-9 items-center gap-2 rounded-lg border border-border bg-background px-3 focus-within:border-ring focus-within:ring-2 focus-within:ring-ring/20">
                  <Search className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                  <span className="sr-only">筛选子贴</span>
                  <Combobox.Input
                    ref={inputRef}
                    placeholder="搜索子贴标题"
                    aria-activedescendant={activeOptionId}
                    onKeyDown={handleInputKeyDown}
                    className="h-full min-w-0 flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
                  />
                </label>
              </div>
              <Combobox.Empty className="px-4 py-8 text-center text-sm text-muted-foreground">
                没有匹配的子贴
              </Combobox.Empty>
              <Combobox.List className="max-h-80 overflow-y-auto overscroll-contain p-1.5">
                {(subthread: SubthreadDetail, index) => {
                  const isSelected = subthread.id === selected.id;
                  return (
                    <Combobox.Item
                      key={subthread.id}
                      ref={(element) => {
                        itemRefs.current[index] = element;
                      }}
                      value={subthread}
                      index={index}
                      aria-current={isSelected ? "page" : undefined}
                      data-keyboard-highlighted={keyboardIndex === index ? "" : undefined}
                      onPointerEnter={() => {
                        setKeyboardIndex(-1);
                        setActiveOptionId(undefined);
                      }}
                      className={cn(
                        "grid min-h-11 w-full cursor-default grid-cols-[1rem_minmax(0,1fr)_auto] items-center gap-2 rounded-lg px-2.5 py-2 outline-none select-none data-highlighted:bg-accent/70 data-highlighted:text-accent-foreground focus:bg-accent/70",
                        isSelected && "bg-accent text-accent-foreground",
                        keyboardIndex === index && "bg-accent/70 text-accent-foreground",
                      )}
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
                    </Combobox.Item>
                  );
                }}
              </Combobox.List>
            </Combobox.Popup>
          </Combobox.Positioner>
        </Combobox.Portal>
      </Combobox.Root>

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
