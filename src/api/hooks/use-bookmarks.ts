/** 我的收藏列表 API hook（GET /bookmarks，cursor 分页，含 bookmarkId） */

import { useInfiniteQuery } from "@tanstack/react-query";
import { apiClient } from "@/api/client";
import { queryKeys } from "@/api/query-keys";
import type { components, operations } from "@/api/types";

export type BookmarkedThread =
  components["schemas"]["OwnBookmarkThreadResponseDto"];
export type BookmarksResponse =
  operations["BookmarksController_findAll"]["responses"][200]["content"]["application/json"];

export function useBookmarks() {
  return useInfiniteQuery({
    queryKey: queryKeys.bookmarks.all,
    queryFn: async ({ pageParam }: { pageParam: string | undefined }) => {
      const queryParams: Record<string, string> = { limit: "10" };
      if (pageParam) queryParams.cursor = pageParam;

      const { data, error } = await apiClient.GET("/api/v1/bookmarks", {
        params: { query: queryParams },
      });
      if (error) throw error;

      if (!data?.data) {
        return {
          code: 0,
          message: "ok",
          data: [],
          meta: { cursor: null, hasMore: false },
        } satisfies BookmarksResponse;
      }
      return data;
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => {
      if (!lastPage?.meta?.hasMore) return undefined;
      return lastPage.meta.cursor ?? undefined;
    },
    staleTime: 10 * 1000,
  });
}
