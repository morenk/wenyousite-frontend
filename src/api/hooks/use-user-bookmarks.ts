/** 指定用户的收藏列表 API hook（GET /users/:id/bookmarks，受 showBookmarks 控制） */

import { useInfiniteQuery } from "@tanstack/react-query";
import { apiClient } from "@/api/client";
import type { ThreadOwner } from "./use-threads";

export interface UserBookmarkedThread {
  id: string;
  title: string;
  category: string;
  status: string;
  visibility: "PUBLIC" | "PRIVATE";
  published: boolean;
  pinned: boolean;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  owner: ThreadOwner;
  _count: { members: number; posts: number };
}

export interface UserBookmarksResponse {
  code: number;
  message: string;
  data: UserBookmarkedThread[];
  meta: { cursor: string | null; hasMore: boolean };
}

export function useUserBookmarks(userId: string | undefined) {
  return useInfiniteQuery({
    queryKey: ["user", "bookmarks", userId],
    queryFn: async ({ pageParam }: { pageParam: string | undefined }) => {
      if (!userId) throw new Error("缺少用户 ID");
      const queryParams: Record<string, string> = { limit: "10" };
      if (pageParam) queryParams.cursor = pageParam;

      const { data, error } = await apiClient.GET("/api/v1/users/{id}/bookmarks", {
        params: { path: { id: userId }, query: queryParams },
      });
      if (error) throw error;

      const response = data as unknown as UserBookmarksResponse;
      if (!response?.data) {
        return {
          code: 0,
          message: "ok",
          data: [],
          meta: { cursor: null, hasMore: false },
        } as UserBookmarksResponse;
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
    retry: false,
  });
}
