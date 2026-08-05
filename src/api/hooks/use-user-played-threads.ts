/** 用户参与的帖子 API hook（GET /users/:id/played-threads，cursor 分页） */

import { useInfiniteQuery } from "@tanstack/react-query";
import { apiClient } from "@/api/client";
import type { operations } from "@/api/types";
import type { ThreadCardData } from "./use-threads";

type PlayedThreadsQuery = NonNullable<
  operations["UsersController_getUserPlayedThreads"]["parameters"]["query"]
>;
export type PlayedThreadVisibility = NonNullable<PlayedThreadsQuery["visibility"]>;

export interface PlayedThreadsResponse {
  code: number;
  message: string;
  data: ThreadCardData[];
  meta: { cursor: string | null; hasMore: boolean };
}

export function useUserPlayedThreads(
  userId: string | undefined,
  visibility?: PlayedThreadVisibility,
) {
  return useInfiniteQuery({
    queryKey: ["user", "played-threads", userId, visibility ?? "ALL"],
    queryFn: async ({ pageParam }: { pageParam: string | undefined }) => {
      if (!userId) throw new Error("缺少用户 ID");
      const queryParams: PlayedThreadsQuery = { limit: 10 };
      if (pageParam) queryParams.cursor = pageParam;
      if (visibility) queryParams.visibility = visibility;

      const { data, error } = await apiClient.GET(
        "/api/v1/users/{id}/played-threads",
        { params: { path: { id: userId }, query: queryParams } },
      );
      if (error) throw error;

      const response = data as unknown as PlayedThreadsResponse;
      if (!response?.data) {
        return {
          code: 0,
          message: "ok",
          data: [],
          meta: { cursor: null, hasMore: false },
        } as PlayedThreadsResponse;
      }
      return response;
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => {
      if (!lastPage?.meta?.hasMore) return undefined;
      return lastPage.meta.cursor ?? undefined;
    },
    enabled: !!userId,
    staleTime: 10 * 1000,
  });
}
