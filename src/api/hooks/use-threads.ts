/** 主题帖列表 API hook */

import { useInfiniteQuery } from "@tanstack/react-query";
import { apiClient } from "@/api/client";

export interface ThreadOwner {
  id: string;
  username: string;
  avatar: string | null;
}

export interface ThreadTag {
  id: string;
  name: string;
  color: string | null;
}

export interface ThreadCardData {
  id: string;
  title: string;
  category: "DEDUCTION" | "NATION" | "RPG";
  status: "RECRUITING" | "CLOSED" | "FINISHED";
  visibility: "PUBLIC" | "PRIVATE";
  published: boolean;
  pinned: boolean;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  owner: ThreadOwner;
  defaultSubthread: { id: string; title: string } | null;
  topicTags: { tag: ThreadTag }[];
  _count: { members: number; posts: number };
  preview: string;
}

export interface ThreadListResponse {
  code: number;
  message: string;
  data: ThreadCardData[];
  meta: {
    cursor: string | null;
    hasMore: boolean;
  };
}

interface ThreadQueryParams {
  filter?: "all" | "playing";
  category?: "DEDUCTION" | "NATION" | "RPG";
  sort?: "recommended" | "newest" | "active";
  tag?: string;
  limit?: number;
  cursor?: string;
}

export function useThreads(params: ThreadQueryParams = {}) {
  return useInfiniteQuery({
    queryKey: ["threads", params],
    queryFn: async ({ pageParam }: { pageParam: string | undefined }) => {
      const queryParams: Record<string, string> = {};
      if (params.category) queryParams.category = params.category;
      if (params.sort) queryParams.sort = params.sort;
      if (params.tag) queryParams.tag = params.tag;
      if (params.filter) queryParams.filter = params.filter;
      queryParams.limit = String(params.limit ?? 20);
      if (pageParam) queryParams.cursor = pageParam;

      const { data, error } = await apiClient.GET("/api/v1/threads", {
        params: { query: queryParams },
      });
      if (error) throw error;

      const response = data as unknown as ThreadListResponse;
      if (!response?.data) {
        return {
          code: 0,
          message: "ok",
          data: [],
          meta: { cursor: null, hasMore: false },
        } as ThreadListResponse;
      }
      return response;
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => {
      if (!lastPage?.meta?.hasMore) return undefined;
      return lastPage.meta.cursor ?? undefined;
    },
    staleTime: 30 * 1000,
  });
}
