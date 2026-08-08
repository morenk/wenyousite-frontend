/** 楼中楼回复列表 API hook（cursor 分页） */

import { useInfiniteQuery } from "@tanstack/react-query";
import { apiClient } from "@/api/client";
import { queryKeys } from "@/api/query-keys";
import type { operations } from "@/api/types";
import type { ReplyFilters } from "@/api/reply-query";

export type ReplyListResponse = operations["postsFindReplies"]["responses"][200]["content"]["application/json"];

const defaultFilters: ReplyFilters = { order: "OLDEST" };

export function useReplies(postId: string | undefined, filters: ReplyFilters = defaultFilters) {
  return useInfiniteQuery({
    queryKey: queryKeys.replies.list(postId, filters),
    queryFn: async ({ pageParam }: { pageParam: string | undefined }) => {
      if (!postId) throw new Error("缺少楼层 ID");
      const queryParams = {
        limit: 20,
        order: filters.order,
        ...(filters.authorId ? { authorId: filters.authorId } : {}),
        ...(pageParam ? { cursor: pageParam } : {}),
      };

      const { data, error } = await apiClient.GET("/api/v1/posts/{id}/replies", {
        params: { path: { id: postId }, query: queryParams },
      });
      if (error) throw error;

      if (!data?.data) {
        return {
          code: 0,
          message: "ok",
          data: [],
          meta: { cursor: null, hasMore: false },
        } satisfies ReplyListResponse;
      }
      return data;
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => {
      if (!lastPage?.meta?.hasMore) return undefined;
      return lastPage.meta.cursor ?? undefined;
    },
    enabled: !!postId,
    staleTime: 5 * 1000,
  });
}
