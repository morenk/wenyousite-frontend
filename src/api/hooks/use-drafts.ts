/** 我的草稿列表 API hook（GET /threads/draft，未发布帖） */

import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/api/client";
import { queryKeys } from "@/api/query-keys";
import type { components } from "@/api/types";

export type DraftThread = components["schemas"]["DraftThreadResponseDto"];

export function useDrafts() {
  return useQuery({
    queryKey: queryKeys.threadDrafts,
    queryFn: async () => {
      const { data, error } = await apiClient.GET("/api/v1/threads/draft");
      if (error) throw error;
      return data?.data ?? [];
    },
    staleTime: 10 * 1000,
  });
}
