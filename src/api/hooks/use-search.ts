/** 全文搜索 API hook（GET /search?q=，主题帖 + 楼层内容） */

import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/api/client";
import type { ThreadOwner } from "./use-threads";

export interface SearchThread {
  id: string;
  title: string;
  category: string;
  createdAt: string;
  owner: ThreadOwner;
  _count: { members: number; posts: number };
}

export interface SearchPost {
  id: string;
  floorNumber: number | null;
  content: string;
  createdAt: string;
  author: { id: string; username: string };
  thread: { id: string; title: string };
  subthread: { id: string; title: string };
}

export interface SearchResult {
  threads: SearchThread[];
  posts: SearchPost[];
}

interface SearchResponse {
  code: number;
  message: string;
  data: SearchResult;
}

export function useSearch(q: string) {
  const keyword = q.trim();
  return useQuery({
    queryKey: ["search", keyword],
    queryFn: async () => {
      const { data, error } = await apiClient.GET("/api/v1/search", {
        params: { query: { q: keyword } },
      });
      if (error) throw error;
      const response = data as unknown as SearchResponse;
      return (
        response?.data ?? { threads: [], posts: [] }
      ) as SearchResult;
    },
    enabled: keyword.length > 0,
    staleTime: 30 * 1000,
  });
}
