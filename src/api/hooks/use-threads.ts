/** 主题帖列表 API hook */

import { keepPreviousData, useInfiniteQuery } from "@tanstack/react-query";
import { apiClient } from "@/api/client";
import { BROWSING_RETURN_GC_TIME } from "@/api/query-policy";
import { queryKeys } from "@/api/query-keys";
import type { components, operations } from "@/api/types";

export type ThreadOwner = components["schemas"]["PostAuthorResponseDto"];
export type ThreadTag = components["schemas"]["ThreadTagResponseDto"];
export type ThreadCardData =
  components["schemas"]["HomeThreadListItemResponseDto"];
export type ThreadListResponse =
  operations["threadsFindAll"]["responses"][200]["content"]["application/json"];

export type ThreadSort = "recommended" | "newest" | "active";
export type ThreadStatusFilter = "RECRUITING" | "CLOSED" | "FINISHED";

export type ThreadQueryParams = NonNullable<
  operations["threadsFindAll"]["parameters"]["query"]
>;

export function useThreads(params: ThreadQueryParams = {}) {
  return useInfiniteQuery({
    queryKey: queryKeys.threads.list(params),
    queryFn: async ({ pageParam }: { pageParam: string | undefined }) => {
      const queryParams: ThreadQueryParams = {};
      if (params.category) queryParams.category = params.category;
      if (params.sort) queryParams.sort = params.sort;
      if (params.status) queryParams.status = params.status;
      if (params.tag) queryParams.tag = params.tag;
      if (params.tagId) queryParams.tagId = params.tagId;
      if (params.filter) queryParams.filter = params.filter;
      queryParams.limit = params.limit ?? 20;
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
    placeholderData: keepPreviousData,
    staleTime: 60 * 1000,
    gcTime: BROWSING_RETURN_GC_TIME,
  });
}
