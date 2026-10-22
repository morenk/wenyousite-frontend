"use client";

import { queryOptions, useQuery } from "@tanstack/react-query";
import { apiClient } from "@/api/client";
import { queryKeys } from "@/api/query-keys";

import { legacyTextFontRouting } from "@/lib/legacy-text-font-routing";

export function apiMetaQueryOptions() {
  return queryOptions({
    queryKey: queryKeys.meta,
    queryFn: async ({ signal }) => {
      const { data, error } = await apiClient.GET("/api/v1/meta", { signal });
      if (error) throw error;
      if (!data) throw new Error("服务能力响应为空");
      legacyTextFontRouting.observeCapability(data.data.capabilities?.textFontV2Supported);
      return data.data;
    },
    staleTime: 5 * 60_000,
    retry: 1,
  });
}

/** 新写能力按当前声明；历史字体的已激活路由不随失败降级。 */
export function useApiMeta(enabled = true) {
  return useQuery({ ...apiMetaQueryOptions(), enabled });
}
