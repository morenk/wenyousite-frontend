/** 指定用户的收藏列表 API hook（GET /users/:id/bookmarks，受 showBookmarks 控制） */

import { useInfiniteQuery } from "@tanstack/react-query";
import { apiClient } from "@/api/client";
import { BROWSING_RETURN_GC_TIME } from "@/api/query-policy";
import { queryKeys } from "@/api/query-keys";
import type { components, operations } from "@/api/types";
import { useViewerScope } from "@/api/use-viewer-scope";

export type UserBookmarkedThread =
  components["schemas"]["BookmarkThreadResponseDto"];
export type UserBookmarksResponse =
  operations["usersGetUserBookmarks"]["responses"][200]["content"]["application/json"];
export type UserMomentBookmarksResponse =
  operations["usersGetUserMomentBookmarks"]["responses"][200]["content"]["application/json"];

export function useUserBookmarks(userId: string | undefined) {
  const viewerScope = useViewerScope();
  return useInfiniteQuery({
    queryKey: queryKeys.users.bookmarksForViewer(userId, viewerScope),
    queryFn: async ({ pageParam }: { pageParam: string | undefined }) => {
      if (!userId) throw new Error("缺少用户 ID");
      const queryParams: Record<string, string> = { limit: "10" };
      if (pageParam) queryParams.cursor = pageParam;

      const { data, error } = await apiClient.GET("/api/v1/users/{id}/bookmarks", {
        params: { path: { id: userId }, query: queryParams },
      });
      if (error) throw error;

      if (!data?.data) {
        return {
          code: 0,
          message: "ok",
          data: [],
          meta: { cursor: null, hasMore: false },
        } satisfies UserBookmarksResponse;
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
    gcTime: BROWSING_RETURN_GC_TIME,
    retry: false,
  });
}

export function useUserMomentBookmarks(userId: string | undefined, enabled = true) {
  const viewerScope = useViewerScope();
  return useInfiniteQuery({
    queryKey: queryKeys.users.momentBookmarksForViewer(userId, viewerScope),
    queryFn: async ({ pageParam }: { pageParam: string | undefined }) => {
      if (!userId) throw new Error("缺少用户 ID");
      const { data, error } = await apiClient.GET("/api/v1/users/{id}/moment-bookmarks", {
        params: {
          path: { id: userId },
          query: { limit: 20, ...(pageParam ? { cursor: pageParam } : {}) },
        },
      });
      if (error) throw error;
      if (!data?.data) {
        return {
          code: 0,
          message: "ok",
          data: [],
          meta: { cursor: null, hasMore: false },
        } satisfies UserMomentBookmarksResponse;
      }
      return data;
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) =>
      lastPage.meta.hasMore ? lastPage.meta.cursor ?? undefined : undefined,
    enabled: enabled && !!userId,
    staleTime: 60 * 1000,
    gcTime: BROWSING_RETURN_GC_TIME,
    retry: false,
  });
}
