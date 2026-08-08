/** 标签搜索 API hook */

import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/api/client";
import { BROWSING_RETURN_GC_TIME } from "@/api/query-policy";
import { queryKeys } from "@/api/query-keys";
import type { components } from "@/api/types";

export type TopicTag = components["schemas"]["TagResponseDto"];

export function useTags(query: string) {
  return useQuery({
    queryKey: queryKeys.topicTags(query),
    queryFn: async () => {
      const params: Record<string, string> = {};
      if (query.trim()) params.q = query.trim();
      const { data, error } = await apiClient.GET("/api/v1/tags", {
        params: { query: params },
      });
      if (error) throw error;
      if (!data) throw new Error("标签列表响应为空");
      return data.data;
    },
    enabled: query.trim().length > 0,
    staleTime: 60 * 1000,
  });
}

export function useTag(tagId: string) {
  return useQuery({
    queryKey: queryKeys.topicTag(tagId),
    queryFn: async () => {
      const { data, error } = await apiClient.GET("/api/v1/tags/{id}", {
        params: { path: { id: tagId } },
      });
      if (error) throw error;
      if (!data) throw new Error("标签详情响应为空");
      return data.data;
    },
    enabled: !!tagId,
    staleTime: 5 * 60 * 1000,
    gcTime: BROWSING_RETURN_GC_TIME,
  });
}
