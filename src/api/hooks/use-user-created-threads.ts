/** 用户创建的帖子 API hook（GET /users/:id/created-threads，cursor 分页） */

import { useInfiniteQuery } from "@tanstack/react-query";
import { emptyCursorPage, getNextCursor } from "@/api/cursor-page";
import { apiClient } from "@/api/client";
import { BROWSING_RETURN_GC_TIME } from "@/api/query-policy";
import { queryKeys } from "@/api/query-keys";
import type { operations } from "@/api/types";
import { useViewerScope } from "@/api/use-viewer-scope";

export type CreatedThreadsResponse =
  operations["usersGetUserCreatedThreads"]["responses"][200]["content"]["application/json"];

export function useUserCreatedThreads(userId: string | undefined) {
  const viewerScope = useViewerScope();
  return useInfiniteQuery({
    queryKey: queryKeys.users.createdThreadsForViewer(userId, viewerScope),
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
        return emptyCursorPage<CreatedThreadsResponse["data"][number]>() satisfies CreatedThreadsResponse;
      }
      return data;
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: getNextCursor,
    enabled: !!userId,
    staleTime: 60 * 1000,
    gcTime: BROWSING_RETURN_GC_TIME,
  });
}
