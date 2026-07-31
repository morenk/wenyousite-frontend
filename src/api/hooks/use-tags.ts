/** 标签搜索 API hook */

import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/api/client";

export interface TopicTag {
  id: string;
  name: string;
  color: string | null;
}

interface TagsResponse {
  code: number;
  message: string;
  data: TopicTag[];
}

export function useTags(query: string) {
  return useQuery({
    queryKey: ["tags", query],
    queryFn: async () => {
      const params: Record<string, string> = {};
      if (query.trim()) params.q = query.trim();
      const { data, error } = await apiClient.GET("/api/v1/tags", {
        params: { query: params },
      });
      if (error) throw error;
      return (data as unknown as TagsResponse).data;
    },
    enabled: query.trim().length > 0,
    staleTime: 60 * 1000,
  });
}
