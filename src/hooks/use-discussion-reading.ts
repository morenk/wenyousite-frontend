import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { toast } from "sonner";
import type { DiscussionPosition } from "@/components/shared/discussion-virtual-list";
import { getVisibleDiscussionPosition } from "@/lib/discussion-target-reveal";
import { getApiError } from "@/api/errors";

export interface DiscussionFilters { order: "OLDEST" | "NEWEST"; authorId?: string }
export type DiscussionLocator = { number: number } | { postId: string };
interface Options {
  scope: string;
  subject: "楼层" | "回复";
  filters: DiscussionFilters;
  initialTarget?: string;
  locate: (locator: DiscussionLocator, filters?: DiscussionFilters, signal?: AbortSignal) => Promise<{ target: { id: string; number: number } | null }>;
  onFiltersChange: (filters: DiscussionFilters) => Promise<void> | void;
  beforeJump: () => Promise<boolean>;
  filteredErrorCode: number;
}
interface ReturnPoint { position: DiscussionPosition; filters: DiscussionFilters }
interface Location { context: string; id: string; activation: number; offset?: number; previous?: ReturnPoint }

/** 单次返回保存真实 ID、条目内偏移及筛选；不持久化阅读进度。 */
export function useDiscussionReading({ scope, subject, filters, initialTarget, locate, onFiltersChange, beforeJump, filteredErrorCode }: Options) {
  const contextFor = (filters: DiscussionFilters) => JSON.stringify([scope, filters]);
  const context = contextFor(filters);
  const [location, setLocation] = useState<Location>();
  const [current, setCurrent] = useState<{ context: string; number: number }>();
  const position = useRef<{ context: string; value: DiscussionPosition } | undefined>(undefined);
  const jumpOrigin = useRef<typeof position.current>(undefined);
  const currentContext = useRef(context);
  const operation = useRef<{ controller: AbortController; contexts: Set<string> } | undefined>(undefined);
  useLayoutEffect(() => {
    currentContext.current = context;
    if (operation.current && !operation.current.contexts.has(context)) operation.current.controller.abort();
  }, [context]);
  useEffect(() => () => { operation.current?.controller.abort(); operation.current = undefined; }, []);
  const begin = (signal?: AbortSignal) => {
    operation.current?.controller.abort();
    const next = { controller: new AbortController(), contexts: new Set([context]) };
    operation.current = next;
    const combined = signal ? AbortSignal.any([signal, next.controller.signal]) : next.controller.signal;
    return { signal: combined, accept: (filters: DiscussionFilters) => next.contexts.add(contextFor(filters)),
      live: () => operation.current === next && !combined.aborted && next.contexts.has(currentContext.current) };
  };
  const active = location?.context === context ? location : undefined;
  const onPosition = useCallback((next: DiscussionPosition) => {
    position.current = { context, value: next };
    setCurrent((value) => value?.context === context && value.number === next.number ? value : { context, number: next.number });
  }, [context]);
  const jump = async (number: number, signal?: AbortSignal) => {
    const request = begin(signal);
    const canJump = await beforeJump();
    if (!request.live()) return;
    if (!canJump) throw new Error("请先完成当前编辑");
    const origin = jumpOrigin.current?.context === context ? jumpOrigin.current : position.current;
    jumpOrigin.current = undefined;
    const previous = origin?.context === context ? { position: { ...origin.value }, filters: { ...filters } } : undefined;
    let nextFilters = filters;
    let result;
    try { result = await locate({ number }, undefined, request.signal); }
    catch (error) {
      if (!request.live()) return;
      if (!filters.authorId || getApiError(error).code !== filteredErrorCode) throw error;
      nextFilters = { order: filters.order };
      request.accept(nextFilters);
      result = await locate({ number }, nextFilters, request.signal).catch((error) => {
        if (!request.live()) return null;
        throw error;
      });
      if (!request.live()) return;
      await onFiltersChange(nextFilters);
      if (!request.live()) return;
      toast.info(`已清除作者筛选，显示目标${subject}`);
    }
    if (!request.live()) return;
    if (!result?.target) throw new Error(`未找到该${subject}`);
    setLocation((old) => ({ context: contextFor(nextFilters), id: result.target!.id, activation: (old?.activation ?? 0) + 1, previous }));
  };
  const returnToPrevious = active?.previous ? async () => {
    const previous = active.previous!;
    const request = begin();
    if (!(await beforeJump()) || !request.live()) return;
    request.accept(previous.filters);
    const result = await locate({ postId: previous.position.id }, previous.filters, request.signal).catch((error) => {
      if (!request.live()) return null;
      throw error;
    });
    if (!request.live()) return;
    if (!result?.target) throw new Error(`原${subject}已无法访问`);
    await onFiltersChange(previous.filters);
    if (!request.live()) return;
    setLocation({ context: contextFor(previous.filters), id: result.target.id, activation: active.activation + 1, offset: previous.position.offset });
  } : undefined;
  const cancelPending = () => {
    operation.current?.controller.abort();
    // 在弹层锁定滚动、焦点切换前采样；滚动 RAF 可能尚未更新上一次记录。
    const visible = getVisibleDiscussionPosition();
    if (visible) onPosition(visible);
    jumpOrigin.current = position.current ? { context: position.current.context, value: { ...position.current.value } } : undefined;
  };
  return { cancelPending, current: current?.context === context ? current.number : undefined, targetId: active?.id ?? initialTarget, activation: active?.activation ?? 0, restoreOffset: active?.offset, jump, returnToPrevious, onPosition };
}
