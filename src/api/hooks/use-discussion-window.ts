/** 讨论的双向小窗口：单次定位、最多五页缓存，选区/编辑条目在裁剪前受保护。 */
import { useCallback, useEffect, useLayoutEffect, useRef } from "react";
import { useInfiniteQuery, useQueryClient, CancelledError, type InfiniteData, type QueryClient } from "@tanstack/react-query";
import { apiClient } from "@/api/client";
import { queryKeys } from "@/api/query-keys";
import type { components } from "@/api/types";
import { useViewerScope } from "@/api/use-viewer-scope";
import { shouldRetryContentQuery } from "@/api/errors";
type PostData = components["schemas"]["FloorResponseDto"];
type ReplyData = components["schemas"]["ReplyResponseDto"];
import type { DiscussionFilters, DiscussionLocator } from "@/hooks/use-discussion-reading";

type Scope = "floors" | "replies";
type PageParam = DiscussionLocator | { cursor: string } | undefined;
export type DiscussionWindow<T> = Omit<components["schemas"]["FloorWindowResponseDto"], "items" | "pinnedItems"> & { items: T[]; pinnedItems: T[] };
export interface DiscussionPage<T> { data: T[]; window: Omit<DiscussionWindow<T>, "items">; pinSession?: boolean }
export const DISCUSSION_MAX_PAGES = 5;
const WINDOW_LIMIT = 20;
type Reader<T> = (id: string, filters: DiscussionFilters, locator?: PageParam, signal?: AbortSignal) => Promise<DiscussionWindow<T>>;

const readFloors: Reader<PostData> = async (subthreadId, filters, locator, signal) => {
  const { data, error } = await apiClient.GET("/api/v1/subthreads/{subthreadId}/posts/window", {
    params: { path: { subthreadId }, query: { ...filters, ...locator, limit: WINDOW_LIMIT } }, signal,
  });
  if (error) throw error;
  if (!data?.data) throw new Error("楼层窗口响应为空");
  return data.data;
};
const readReplies: Reader<ReplyData> = async (id, filters, locator, signal) => {
  const { data, error } = await apiClient.GET("/api/v1/posts/{id}/replies/window", {
    params: { path: { id }, query: { ...filters, ...locator, limit: WINDOW_LIMIT } }, signal,
  });
  if (error) throw error;
  if (!data?.data) throw new Error("回复窗口响应为空");
  return { ...data.data, pinnedItems: [] };
};
function page<T>(value: DiscussionWindow<T>, pins = value.pinnedItems, pinSession = false): DiscussionPage<T> {
  const { items, ...window } = value;
  return { data: items, window: { ...window, pinnedItems: pins }, pinSession };
}
function options<T>(scope: Scope, id: string | undefined, filters: DiscussionFilters, viewer: string, initialTarget: string | undefined, read: Reader<T>, queryClient?: QueryClient) {
  const queryKey = queryKeys[scope].window(id, filters, viewer, initialTarget);
  let refreshedPins: Promise<T[]> | undefined;
  return {
    queryKey,
    queryFn: async ({ pageParam, signal }: { pageParam: PageParam; signal: AbortSignal }) => {
      if (!id) throw new Error("缺少讨论范围");
      const previous = queryClient?.getQueryData<InfiniteData<DiscussionPage<T>, PageParam>>(queryKey);
      const cursor = pageParam && "cursor" in pageParam ? pageParam.cursor : undefined;
      const pinSession = cursor ? previous?.pages[0]?.pinSession === true : scope === "floors" && !pageParam;
      const firstParam = previous?.pageParams[0];
      // 首屏已裁掉后的重取只补一次同 scope 默认窗，以刷新置顶正文、状态与回复预览。
      // 后续页共享本次快照；自然窗口和精确定位会话都不会被默认窗替换。
      if (pinSession && cursor && firstParam && "cursor" in firstParam && cursor === firstParam.cursor) {
        refreshedPins = read(id, filters, undefined, signal).then((value) => value.pinnedItems);
      }
      const [value, carriedPins] = await Promise.all([
        read(id, filters, pageParam, signal),
        refreshedPins ?? Promise.resolve(previous?.pages[0]?.window.pinnedItems),
      ]);
      if (!pageParam && pinSession) refreshedPins = Promise.resolve(value.pinnedItems);
      const pins = cursor ? carriedPins ?? value.pinnedItems : value.pinnedItems;
      return page(value, pins, pinSession);
    },
    initialPageParam: initialTarget ? { postId: initialTarget } as PageParam : undefined as PageParam,
    getNextPageParam: (last: DiscussionPage<T>) => last.window.hasAfter && last.window.afterCursor ? { cursor: last.window.afterCursor } : undefined,
    getPreviousPageParam: (first: DiscussionPage<T>) => first.window.hasBefore && first.window.beforeCursor ? { cursor: first.window.beforeCursor } : undefined,
    maxPages: DISCUSSION_MAX_PAGES,
    staleTime: 30_000,
    gcTime: 60_000,
    retry: shouldRetryContentQuery,
    enabled: !!id,
  };
}
export function floorWindowQueryOptions(id: string, filters: DiscussionFilters = { order: "OLDEST" }, viewer = "anonymous") {
  return options("floors", id, filters, viewer, undefined, readFloors);
}
function useWindow<T extends { id: string }>(scope: Scope, id: string | undefined, filters: DiscussionFilters, initialTarget: string | undefined, protectedIds: readonly string[], read: Reader<T>) {
  const viewer = useViewerScope();
  const client = useQueryClient();
  const context = JSON.stringify([scope, id, filters, viewer, initialTarget]);
  const currentContext = useRef(context);
  const operation = useRef<AbortController | undefined>(undefined);
  useLayoutEffect(() => {
    if (currentContext.current !== context) operation.current?.abort();
    currentContext.current = context;
  }, [context]);
  useEffect(() => () => operation.current?.abort(), []);
  const protectedNow = useRef(protectedIds);
  useLayoutEffect(() => { protectedNow.current = protectedIds; }, [protectedIds]);
  const baseOptions = options(scope, id, filters, viewer, initialTarget, read, client);
  const queryOptions = { ...baseOptions, queryFn: async (request: { pageParam: PageParam; signal: AbortSignal }) => {
    const value = await baseOptions.queryFn(request);
    const previous = client.getQueryData<InfiniteData<DiscussionPage<T>>>(baseOptions.queryKey)?.pages;
    if (previous && previous.length >= DISCUSSION_MAX_PAGES && request.pageParam && "cursor" in request.pageParam) {
      const cursor = request.pageParam.cursor;
      const evicted = cursor === previous.at(-1)?.window.afterCursor ? previous[0] : cursor === previous[0].window.beforeCursor ? previous.at(-1) : undefined;
      if (evicted?.data.some((item) => protectedNow.current.includes(item.id))) {
        void client.cancelQueries({ queryKey: baseOptions.queryKey, exact: true }, { revert: true });
        throw new CancelledError({ revert: true });
      }
    }
    return value;
  } };
  const query = useInfiniteQuery(queryOptions);
  const pages = query.data?.pages ?? [];
  const protects = (candidate?: DiscussionPage<T>) => !!candidate?.data.some((item) => protectedIds.includes(item.id));
  const canNext = pages.length < DISCUSSION_MAX_PAGES || !protects(pages[0]);
  const canPrevious = pages.length < DISCUSSION_MAX_PAGES || !protects(pages.at(-1));
  const locate = useCallback(async (locator: DiscussionLocator, override?: DiscussionFilters, signal?: AbortSignal) => {
    if (!id) throw new Error("缺少讨论范围");
    operation.current?.abort();
    const controller = new AbortController();
    operation.current = controller;
    const combined = signal ? AbortSignal.any([signal, controller.signal]) : controller.signal;
    const live = () => operation.current === controller && currentContext.current === context && !combined.aborted;
    const value = await read(id, override ?? filters, locator, combined);
    if (!live()) throw new DOMException("定位已取消", "AbortError");
    const key = queryKeys[scope].window(id, override ?? filters, viewer, initialTarget);
    await client.cancelQueries({ queryKey: key, exact: true });
    if (!live()) throw new DOMException("定位已取消", "AbortError");
    client.setQueryData<InfiniteData<DiscussionPage<T>, PageParam>>(key, { pages: [page(value, [])], pageParams: [locator] });
    return { target: value.target };
  }, [client, context, filters, id, initialTarget, read, scope, viewer]);
  return {
    ...query, locate, viewerScope: viewer,
    total: pages[0]?.window.total ?? 0, maxNumber: pages[0]?.window.maxNumber ?? 0,
    pinnedItems: pages[0]?.window.pinnedItems ?? [],
    hasNextPage: query.hasNextPage && canNext, hasPreviousPage: query.hasPreviousPage && canPrevious,
    fetchNextPage: () => canNext && !query.isFetching ? query.fetchNextPage() : Promise.resolve(),
    fetchPreviousPage: () => canPrevious && !query.isFetching ? query.fetchPreviousPage() : Promise.resolve(),
  };
}
export function useFloorWindow(id: string | undefined, filters: DiscussionFilters, initialTarget?: string, protectedIds: readonly string[] = []) {
  return useWindow("floors", id, filters, initialTarget, protectedIds, readFloors);
}
export function useReplyWindow(id: string | undefined, filters: DiscussionFilters, initialTarget?: string, protectedIds: readonly string[] = []) {
  return useWindow("replies", id, filters, initialTarget, protectedIds, readReplies);
}

/** 删除后移除所有小窗口中的条目，并把重取锚点换为仍可见邻居。 */
export function removeDiscussionWindowPost(client: QueryClient, postId: string) {
  for (const prefix of [queryKeys.floors.all, queryKeys.replies.all]) {
    client.setQueriesData<InfiniteData<DiscussionPage<{ id: string }>, PageParam>>({ queryKey: prefix, predicate: (query) => query.queryKey[2] === "window" }, (old) => {
      if (!old) return old;
      const pages = old.pages.map((current) => ({ ...current, data: current.data.filter((item) => item.id !== postId), window: { ...current.window, pinnedItems: current.window.pinnedItems.filter((item) => item.id !== postId) } }));
      const replacement = pages.flatMap((current) => current.data)[0]?.id;
      return { pages, pageParams: old.pageParams.map((param, index) => param && (("postId" in param && param.postId === postId) || ("number" in param && old.pages[index].window.target?.id === postId)) ? replacement ? { postId: replacement } : undefined : param) };
    });
  }
}
