/** 主题帖列表 API hook */

import { useInfiniteQuery } from "@tanstack/react-query";
import { apiClient } from "@/api/client";
import { queryKeys } from "@/api/query-keys";
import type { components, operations } from "@/api/types";

export type ThreadOwner = components["schemas"]["PostAuthorResponseDto"];
export type ThreadTag = components["schemas"]["ThreadTagResponseDto"];
export type ThreadCardData =
  components["schemas"]["HomeThreadListItemResponseDto"];
export type ThreadListResponse =
  operations["ThreadsController_findAll"]["responses"][200]["content"]["application/json"];

export type ThreadSort = "recommended" | "newest" | "active";
export type ThreadStatusFilter = "RECRUITING" | "CLOSED" | "FINISHED";

interface ThreadQueryParams {
  filter?: "all" | "playing";
  category?: "DEDUCTION" | "NATION" | "RPG";
  sort?: ThreadSort;
  status?: ThreadStatusFilter;
  tag?: string;
  limit?: number;
  cursor?: string;
}

export function useThreads(params: ThreadQueryParams = {}) {
  return useInfiniteQuery({
    queryKey: queryKeys.threads.list(params),
    queryFn: async ({ pageParam }: { pageParam: string | undefined }) => {
      const queryParams: Record<string, string> = {};
      if (params.category) queryParams.category = params.category;
      if (params.sort) queryParams.sort = params.sort;
      if (params.status) queryParams.status = params.status;
      if (params.tag) queryParams.tag = params.tag;
      if (params.filter) queryParams.filter = params.filter;
      queryParams.limit = String(params.limit ?? 20);
      if (pageParam) queryParams.cursor = pageParam;

      const { data, error } = await apiClient.GET("/api/v1/threads", {
        params: { query: queryParams },
      });
      if (error) throw error;

      if (!data?.data) {
        return {
          code: 0,
          message: "ok",
          data: [],
          meta: { cursor: null, hasMore: false },
        } satisfies ThreadListResponse;
      }
      return data;
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => {
      if (!lastPage?.meta?.hasMore) return undefined;
      return lastPage.meta.cursor ?? undefined;
    },
    staleTime: 60 * 1000,
  });
}
