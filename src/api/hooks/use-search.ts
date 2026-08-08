/** 分类搜索 hooks：各 Tab 独立请求，楼层正文使用游标分页。 */

import { keepPreviousData, useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { apiClient } from "@/api/client";
import { BROWSING_RETURN_GC_TIME } from "@/api/query-policy";
import { queryKeys } from "@/api/query-keys";
import type { components } from "@/api/types";

export type SearchUser = components["schemas"]["SearchUserResponseDto"];
export type SearchThread = components["schemas"]["SearchThreadResponseDto"];
export type SearchPost = components["schemas"]["SearchPostResponseDto"];

interface SearchPostPage {
  data: SearchPost[];
  meta: components["schemas"]["ApiPaginationMeta"];
}

function usePostSearchPages(
  queryKey: readonly unknown[],
  enabled: boolean,
  fetchPage: (cursor?: string) => Promise<SearchPostPage>,
) {
  return useInfiniteQuery({
    queryKey,
    queryFn: ({ pageParam }: { pageParam: string | undefined }) =>
      fetchPage(pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) =>
      lastPage.meta.hasMore ? (lastPage.meta.cursor ?? undefined) : undefined,
    enabled,
    placeholderData: keepPreviousData,
    staleTime: 30 * 1000,
    gcTime: BROWSING_RETURN_GC_TIME,
  });
}

export const isPostSearchKeywordValid = (q: string) =>
  Array.from(q.trim()).length >= 2;

export function useSearchThreads(q: string, enabled: boolean) {
  const keyword = q.trim();
  return useQuery({
    queryKey: queryKeys.search.threads(keyword),
    queryFn: async () => {
      const { data, error } = await apiClient.GET("/api/v1/search/threads", {
        params: { query: { q: keyword } },
      });
      if (error) throw error;
      return data?.data ?? [];
    },
    enabled: enabled && keyword.length > 0,
    placeholderData: keepPreviousData,
    staleTime: 30 * 1000,
    gcTime: BROWSING_RETURN_GC_TIME,
  });
}

export function useSearchUsers(q: string, enabled: boolean) {
  const keyword = q.trim();
  return useQuery({
    queryKey: queryKeys.search.users(keyword),
    queryFn: async () => {
      const { data, error } = await apiClient.GET("/api/v1/search/users", {
        params: { query: { q: keyword } },
      });
      if (error) throw error;
      return data?.data ?? [];
    },
    enabled: enabled && keyword.length > 0,
    placeholderData: keepPreviousData,
    staleTime: 30 * 1000,
    gcTime: BROWSING_RETURN_GC_TIME,
  });
}

export function useSearchPosts(q: string, enabled: boolean) {
  const keyword = q.trim();
  return usePostSearchPages(
    ["search", "posts", keyword],
    enabled && isPostSearchKeywordValid(keyword),
    async (pageParam) => {
      const query = pageParam
        ? { q: keyword, limit: 20, cursor: pageParam }
        : { q: keyword, limit: 20 };
      const { data, error } = await apiClient.GET("/api/v1/search/posts", {
        params: { query },
      });
      if (error) throw error;
      return {
        data: data?.data ?? [],
        meta: data?.meta ?? { cursor: null, hasMore: false },
      } satisfies SearchPostPage;
    },
  );
}

export function useThreadSearchPosts(
  threadId: string,
  q: string,
  enabled: boolean,
) {
  const keyword = q.trim();
  return usePostSearchPages(
    ["thread-search", threadId, "posts", keyword],
    enabled && !!threadId && isPostSearchKeywordValid(keyword),
    async (pageParam) => {
      const query = pageParam
        ? { q: keyword, limit: 20, cursor: pageParam }
        : { q: keyword, limit: 20 };
      const { data, error } = await apiClient.GET(
        "/api/v1/threads/{threadId}/search/posts",
        {
          params: { path: { threadId }, query },
        },
      );
      if (error) throw error;
      return {
        data: data?.data ?? [],
        meta: data?.meta ?? { cursor: null, hasMore: false },
      } satisfies SearchPostPage;
    },
  );
}
