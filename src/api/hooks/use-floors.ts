/** 楼层列表 API hook（cursor 分页） */

import { useInfiniteQuery } from "@tanstack/react-query";
import { apiClient } from "@/api/client";

export interface PostAuthor {
  id: string;
  username: string;
  avatar: string | null;
}

export interface PostData {
  id: string;
  threadId: string;
  subthreadId: string;
  authorId: string;
  floorNumber: number | null;
  parentPostId: string | null;
  replyToPostId: string | null;
  content: string;
  version: number;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  author: PostAuthor;
  _count: { replies: number };
  replies: PostData[];
}

export interface FloorListResponse {
  code: number;
  message: string;
  data: PostData[];
  meta: {
    cursor: string | null;
    hasMore: boolean;
  };
}

export function useFloors(subthreadId: string | undefined) {
  return useInfiniteQuery({
    queryKey: ["floors", subthreadId],
    queryFn: async ({ pageParam }: { pageParam: string | undefined }) => {
      if (!subthreadId) throw new Error("缺少子贴 ID");
      const queryParams: Record<string, string> = { limit: "20" };
      if (pageParam) queryParams.cursor = pageParam;

      const { data, error } = await apiClient.GET(
        "/api/v1/subthreads/{subthreadId}/posts",
        {
          params: { path: { subthreadId }, query: queryParams },
        },
      );
      if (error) throw error;

      const response = data as unknown as FloorListResponse;
      if (!response?.data) {
        return {
          code: 0,
          message: "ok",
          data: [],
          meta: { cursor: null, hasMore: false },
        } as FloorListResponse;
      }
      return response;
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => {
      if (!lastPage?.meta?.hasMore) return undefined;
      return lastPage.meta.cursor ?? undefined;
    },
    enabled: !!subthreadId,
    staleTime: 5 * 1000,
  });
}
