/** 用户创建的帖子 API hook（GET /users/:id/created-threads，cursor 分页） */

import { useInfiniteQuery } from "@tanstack/react-query";
import { apiClient } from "@/api/client";
import type { ThreadCardData } from "./use-threads";

export interface CreatedThreadsResponse {
  code: number;
  message: string;
  data: ThreadCardData[];
  meta: { cursor: string | null; hasMore: boolean };
}

export function useUserCreatedThreads(userId: string | undefined) {
  return useInfiniteQuery({
    queryKey: ["user", "created-threads", userId],
    queryFn: async ({ pageParam }: { pageParam: string | undefined }) => {
      if (!userId) throw new Error("缺少用户 ID");
      const queryParams: Record<string, string> = { limit: "10" };
      if (pageParam) queryParams.cursor = pageParam;

      const { data, error } = await apiClient.GET(
        "/api/v1/users/{id}/created-threads",
        { params: { path: { id: userId }, query: queryParams } },
      );
      if (error) throw error;

      const response = data as unknown as CreatedThreadsResponse;
      if (!response?.data) {
        return {
          code: 0,
          message: "ok",
          data: [],
          meta: { cursor: null, hasMore: false },
        } as CreatedThreadsResponse;
      }
      return response;
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
