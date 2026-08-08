/** 管理员配置的公开主题帖分类。 */

import { useQuery } from "@tanstack/react-query";

import { apiClient } from "@/api/client";
import { queryKeys } from "@/api/query-keys";
import type { components } from "@/api/types";

export type ThreadCategoryDefinition =
  components["schemas"]["ThreadCategoryResponseDto"];

export function useThreadCategories() {
  return useQuery({
    queryKey: queryKeys.threadCategories,
    queryFn: async () => {
      const { data, error } = await apiClient.GET("/api/v1/thread-categories");
      if (error) throw error;
      if (!data) throw new Error("主题帖分类响应为空");
      return data.data;
    },
    staleTime: 5 * 60 * 1000,
  });
}
