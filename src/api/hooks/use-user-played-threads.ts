/** 用户参与的帖子 API hook（GET /users/:id/played-threads，cursor 分页） */

import { useInfiniteQuery } from "@tanstack/react-query";
import { apiClient } from "@/api/client";
import { queryKeys } from "@/api/query-keys";
import type { operations } from "@/api/types";
import { useViewerScope } from "@/api/use-viewer-scope";

type PlayedThreadsQuery = NonNullable<
  operations["UsersController_getUserPlayedThreads"]["parameters"]["query"]
>;
export type PlayedThreadVisibility = NonNullable<PlayedThreadsQuery["visibility"]>;

export type PlayedThreadsResponse =
  operations["UsersController_getUserPlayedThreads"]["responses"][200]["content"]["application/json"];

export function useUserPlayedThreads(
  userId: string | undefined,
  visibility?: PlayedThreadVisibility,
) {
  const viewerScope = useViewerScope();
  return useInfiniteQuery({
    queryKey: queryKeys.users.playedThreadsForViewer(
      userId,
      visibility ?? "ALL",
      viewerScope,
    ),
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

      if (!data?.data) {
        return {
          code: 0,
          message: "ok",
          data: [],
          meta: { cursor: null, hasMore: false },
        } satisfies PlayedThreadsResponse;
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
