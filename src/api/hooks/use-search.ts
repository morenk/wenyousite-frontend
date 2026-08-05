/** 分类搜索 hooks：各 Tab 独立请求，楼层正文使用游标分页。 */

import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { apiClient } from "@/api/client";
import type { components } from "@/api/types";

export type SearchUser = components["schemas"]["SearchUserResponseDto"];
export type SearchThread = components["schemas"]["SearchThreadResponseDto"];
export type SearchPost = components["schemas"]["SearchPostResponseDto"];

interface SearchPostPage {
  data: SearchPost[];
  meta: components["schemas"]["ApiPaginationMeta"];
}

export const isPostSearchKeywordValid = (q: string) =>
  Array.from(q.trim()).length >= 2;

export function useSearchThreads(q: string, enabled: boolean) {
  const keyword = q.trim();
  return useQuery({
    queryKey: ["search", "threads", keyword],
    queryFn: async () => {
      const { data, error } = await apiClient.GET("/api/v1/search/threads", {
        params: { query: { q: keyword } },
      });
      if (error) throw error;
      return data?.data ?? [];
    },
    enabled: enabled && keyword.length > 0,
    staleTime: 30 * 1000,
  });
}

export function useSearchUsers(q: string, enabled: boolean) {
  const keyword = q.trim();
  return useQuery({
    queryKey: ["search", "users", keyword],
    queryFn: async () => {
      const { data, error } = await apiClient.GET("/api/v1/search/users", {
        params: { query: { q: keyword } },
      });
      if (error) throw error;
      return data?.data ?? [];
    },
    enabled: enabled && keyword.length > 0,
    staleTime: 30 * 1000,
  });
}

export function useSearchPosts(q: string, enabled: boolean) {
  const keyword = q.trim();
  return useInfiniteQuery({
    queryKey: ["search", "posts", keyword],
    queryFn: async ({ pageParam }: { pageParam: string | undefined }) => {
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
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) =>
      lastPage.meta.hasMore ? (lastPage.meta.cursor ?? undefined) : undefined,
    enabled: enabled && isPostSearchKeywordValid(keyword),
    staleTime: 30 * 1000,
  });
}
