"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { defaultRangeExtractor, useWindowVirtualizer } from "@tanstack/react-virtual";
import { getDiscussionReadingTop, startDiscussionTargetReveal } from "@/lib/discussion-target-reveal";

export interface DiscussionPosition { id: string; number: number; offset: number }
interface Props<T extends { id: string }> {
  items: T[];
  numberOf: (item: T) => number;
  renderItem: (item: T) => ReactNode;
  targetId?: string;
  preserveId?: string;
  activationKey?: string | number;
  restoreOffset?: number;
  leadingContentKey?: string;
  hasBefore?: boolean;
  hasAfter?: boolean;
  fetching?: boolean;
  onBefore?: () => unknown;
  onAfter?: () => unknown;
  onPosition?: (position: DiscussionPosition) => void;
  onProtectedIdsChange?: (ids: string[]) => void;
}

/** 保留有限数据窗口；动态测量高度，裁剪/前插时按真实条目锚点恢复。 */
export function DiscussionVirtualList<T extends { id: string }>({ items, numberOf, renderItem, targetId, preserveId, activationKey, restoreOffset = 0, leadingContentKey = "", hasBefore, hasAfter, fetching, onBefore, onAfter, onPosition, onProtectedIdsChange }: Props<T>) {
  const container = useRef<HTMLDivElement>(null);
  const [layout, setLayout] = useState({ margin: 0, readingTop: 24 });
  const { margin, readingTop } = layout;
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [anchorId, setAnchorId] = useState<string>();
  const position = useRef<(DiscussionPosition & { viewportTop: number }) | undefined>(undefined);
  const previousFirst = useRef<string | undefined>(items[0]?.id);
  const previousLeading = useRef(leadingContentKey);
  const loading = useRef(false);
  const activated = useRef<string | undefined>(undefined);
  const anchorReveal = useRef<ReturnType<typeof startDiscussionTargetReveal> | undefined>(undefined);
  useEffect(() => () => anchorReveal.current?.dispose(), []);
  const targetIndex = items.findIndex((item) => item.id === targetId);
  const preserved = items.flatMap((item, index) => item.id === preserveId || selectedIds.includes(item.id) || item.id === targetId || item.id === anchorId ? [index] : []);
  const virtualizer = useWindowVirtualizer<HTMLDivElement>({
    count: items.length,
    estimateSize: () => 260,
    getItemKey: (index) => items[index].id,
    // 连续讨论条目的留白和分隔由条目自身承载，不再插入卡片间距。
    gap: 0,
    overscan: 4,
    scrollMargin: margin,
    scrollPaddingStart: readingTop,
    initialRect: { width: 720, height: 800 },
    useAnimationFrameWithResizeObserver: true,
    // ref 测量和锚点恢复也可能同步通知；React 生命周期内不强制 flushSync。
    useFlushSync: false,
    rangeExtractor: (range) => [...new Set([...defaultRangeExtractor(range), ...preserved])].sort((a, b) => a - b),
  });
  const virtualItems = virtualizer.getVirtualItems();

  useLayoutEffect(() => {
    const ids = new Set(items.map((item) => item.id));
    // 虚拟器默认跨数据窗口记忆高度；与业务缓存一起回收远处测量。
    for (const key of virtualizer.itemSizeCache.keys()) {
      if (!ids.has(String(key))) virtualizer.itemSizeCache.delete(key);
    }
  }, [items, virtualizer]);

  useLayoutEffect(() => {
    const update = () => {
      if (container.current) {
        const margin = container.current.getBoundingClientRect().top + window.scrollY;
        const readingTop = getDiscussionReadingTop();
        setLayout((old) => old.margin === margin && old.readingTop === readingTop ? old : { margin, readingTop });
      }
    };
    update();
    const observer = new ResizeObserver(update);
    if (container.current) observer.observe(container.current);
    observer.observe(document.body);
    window.addEventListener("resize", update);
    return () => { observer.disconnect(); window.removeEventListener("resize", update); };
  }, []);

  const recordPosition = useCallback(() => {
    const nodes = Array.from(container.current?.querySelectorAll<HTMLElement>("[data-discussion-item]") ?? []);
    const visible = nodes.find((node) => node.getBoundingClientRect().bottom > getDiscussionReadingTop());
    const item = items.find((item) => item.id === visible?.dataset.discussionItem);
    if (!visible || !item) return;
    const viewportTop = visible.getBoundingClientRect().top;
    const next = { id: item.id, number: numberOf(item), offset: viewportTop - getDiscussionReadingTop(), viewportTop };
    position.current = next;
    setAnchorId((old) => old === next.id ? old : next.id);
    onPosition?.(next);
  }, [items, numberOf, onPosition]);

  useLayoutEffect(() => {
    const leadingChanged = previousLeading.current !== leadingContentKey;
    if (previousFirst.current === items[0]?.id && !leadingChanged) return;
    previousFirst.current = items[0]?.id;
    previousLeading.current = leadingContentKey;
    anchorReveal.current?.dispose();
    anchorReveal.current = undefined;
    const activating = targetIndex >= 0 && activated.current !== `${targetId ?? ""}:${activationKey ?? ""}`;
    if (activating || !position.current) return;
    const anchor = position.current;
    const index = items.findIndex((item) => item.id === anchor.id);
    if (index < 0) return;
    if (leadingChanged) {
      const node = document.getElementById(`post-${anchor.id}`);
      // 前置内容移除仅保护原本与阅读区相交的条目，不能把离屏 overscan 拉进视口。
      if (!node || anchor.viewportTop >= window.innerHeight || anchor.viewportTop + node.getBoundingClientRect().height <= getDiscussionReadingTop()) return;
    } else {
      const offset = virtualizer.getOffsetForIndex(index, "start")?.[0];
      if (offset !== undefined) virtualizer.scrollToOffset(offset + getDiscussionReadingTop() - anchor.viewportTop);
    }
    // 前插/裁剪的首帧仍包含估算高度；沿用实测锚点直到用户下一次滚动接管。
    anchorReveal.current = startDiscussionTargetReveal(`post-${anchor.id}`, { viewportTop: anchor.viewportTop });
    if (leadingChanged) anchorReveal.current.refresh();
  }, [activationKey, items, leadingContentKey, targetId, targetIndex, virtualizer]);

  useLayoutEffect(() => {
    // 虚拟行的 translateY 可变化而节点高度不变，单靠 ResizeObserver 会漏掉这一帧。
    anchorReveal.current?.refresh();
  }, [virtualItems, margin]);

  useEffect(() => {
    const key = `${targetId ?? ""}:${activationKey ?? ""}`;
    if (targetIndex < 0 || activated.current === key) return;
    activated.current = key;
    const offset = virtualizer.getOffsetForIndex(targetIndex, "start")?.[0];
    if (offset !== undefined) virtualizer.scrollToOffset(offset - restoreOffset);

  // 精确跳转只在目标激活时执行；翻页、图片测量不得把用户吸回目标。
  }, [targetId, activationKey, targetIndex, restoreOffset, virtualizer]);

  useEffect(() => {
    let frame = 0;
    const scroll = () => {
      if (frame) return;
      frame = requestAnimationFrame(() => { frame = 0; recordPosition(); });
    };
    scroll();
    window.addEventListener("scroll", scroll, { passive: true });
    const selection = () => {
      const selection = window.getSelection();
      const ids = !selection || selection.isCollapsed ? [] : Array.from(container.current?.querySelectorAll<HTMLElement>("[data-discussion-item]") ?? [])
        .filter((node) => selection.containsNode(node, true)).map((node) => node.dataset.discussionItem!);
      setSelectedIds((old) => old.join() === ids.join() ? old : ids);
      onProtectedIdsChange?.(ids);
    };
    document.addEventListener("selectionchange", selection);
    return () => { cancelAnimationFrame(frame); window.removeEventListener("scroll", scroll); document.removeEventListener("selectionchange", selection); };
  }, [recordPosition, onProtectedIdsChange]);

  useEffect(() => {
    if (fetching || loading.current || !items.length || !virtualItems.length) return;
    const top = window.scrollY + getDiscussionReadingTop();
    const visible = virtualItems.filter((item) => item.end >= top && item.start <= window.scrollY + window.innerHeight);
    if (!visible.length) return;
    const first = visible[0].index;
    const last = visible[visible.length - 1].index;
    // 靠近边缘才读取一页；两端均近时按阅读方向优先向后。
    const load = last >= items.length - 3 && hasAfter ? onAfter : first <= 2 && hasBefore ? onBefore : undefined;
    if (!load) return;
    recordPosition();
    loading.current = true;
    void Promise.resolve(load()).finally(() => { loading.current = false; });
  }, [fetching, hasAfter, hasBefore, items.length, onAfter, onBefore, recordPosition, virtualItems]);

  return <div ref={container} className="relative w-full" data-slot="discussion-virtual-list" style={{ height: virtualizer.getTotalSize(), overflowAnchor: "none" }}>
    {virtualItems.map((row) => <div key={row.key} ref={virtualizer.measureElement} data-index={row.index} data-discussion-item={items[row.index].id} data-discussion-number={numberOf(items[row.index])} className="absolute left-0 top-0 w-full" style={{ transform: `translateY(${row.start - margin}px)` }}>{renderItem(items[row.index])}</div>)}
  </div>;
}
