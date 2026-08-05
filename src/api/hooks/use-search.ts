/** 全文搜索 API hook（GET /search?q=，主题帖 + 楼层内容） */

import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/api/client";
import type { components } from "@/api/types";

export type SearchResult = components["schemas"]["SearchResultResponseDto"];

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
        response?.data ?? { users: [], threads: [], posts: [] }
      ) as SearchResult;
    },
    enabled: keyword.length > 0,
    staleTime: 30 * 1000,
  });
}
