/** 用户创建的帖子 API hook（GET /users/:id/created-threads，cursor 分页） */

import { useInfiniteQuery } from "@tanstack/react-query";
import { apiClient } from "@/api/client";
import { queryKeys } from "@/api/query-keys";
import type { operations } from "@/api/types";

export type CreatedThreadsResponse =
  operations["UsersController_getUserCreatedThreads"]["responses"][200]["content"]["application/json"];

export function useUserCreatedThreads(userId: string | undefined) {
  return useInfiniteQuery({
    queryKey: queryKeys.users.createdThreads(userId),
    queryFn: async ({ pageParam }: { pageParam: string | undefined }) => {
      if (!userId) throw new Error("缺少用户 ID");
      const queryParams: Record<string, string> = { limit: "10" };
      if (pageParam) queryParams.cursor = pageParam;

      const { data, error } = await apiClient.GET(
        "/api/v1/users/{id}/created-threads",
        { params: { path: { id: userId }, query: queryParams } },
      );
      if (error) throw error;

      if (!data?.data) {
        return {
          code: 0,
          message: "ok",
          data: [],
          meta: { cursor: null, hasMore: false },
        } satisfies CreatedThreadsResponse;
      }
      return data;
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => {
      if (!lastPage?.meta?.hasMore) return undefined;
      return lastPage.meta.cursor ?? undefined;
    },
    enabled: !!userId,
    staleTime: 60 * 1000,
  });
}
