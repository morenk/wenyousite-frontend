/** 正文草稿列表 API hook（GET /drafts，全局 5 槽位草稿池） */

import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/api/client";
import type { components } from "@/api/types";

/** 正文草稿实体（Draft 模型，userId + slot 联合唯一） */
export type DraftItem = components["schemas"]["DraftResponseDto"];

export function useContentDrafts() {
  return useQuery({
    queryKey: ["content-drafts"],
    queryFn: async () => {
      const { data, error } = await apiClient.GET("/api/v1/drafts");
      if (error) throw error;
      return data?.data ?? [];
    },
    staleTime: 10 * 1000,
  });
}
