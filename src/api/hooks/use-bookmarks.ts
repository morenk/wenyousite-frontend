/** 我的收藏列表 API hook（GET /bookmarks，cursor 分页，含 bookmarkId） */

import { useInfiniteQuery } from "@tanstack/react-query";
import { apiClient } from "@/api/client";
import type { ThreadOwner } from "./use-threads";

export interface BookmarkedThread {
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
  bookmarkId: string;
}

export interface BookmarksResponse {
  code: number;
  message: string;
  data: BookmarkedThread[];
  meta: { cursor: string | null; hasMore: boolean };
}

export function useBookmarks() {
  return useInfiniteQuery({
    queryKey: ["bookmarks"],
    queryFn: async ({ pageParam }: { pageParam: string | undefined }) => {
      const queryParams: Record<string, string> = { limit: "10" };
      if (pageParam) queryParams.cursor = pageParam;

      const { data, error } = await apiClient.GET("/api/v1/bookmarks", {
        params: { query: queryParams },
      });
      if (error) throw error;

      const response = data as unknown as BookmarksResponse;
      if (!response?.data) {
        return {
          code: 0,
          message: "ok",
          data: [],
          meta: { cursor: null, hasMore: false },
        } as BookmarksResponse;
      }
      return response;
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => {
      if (!lastPage?.meta?.hasMore) return undefined;
      return lastPage.meta.cursor ?? undefined;
    },
    staleTime: 10 * 1000,
  });
}
