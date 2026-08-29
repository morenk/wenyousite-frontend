"use client";

import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/api/client";
import { queryKeys } from "@/api/query-keys";

/** 服务端能力事实源；请求失败时调用方按旧协议关闭新增写入能力。 */
export function useApiMeta() {
  return useQuery({
    queryKey: queryKeys.meta,
    queryFn: async () => {
      const { data, error } = await apiClient.GET("/api/v1/meta");
      if (error) throw error;
      if (!data) throw new Error("服务能力响应为空");
      return data.data;
    },
    staleTime: 5 * 60_000,
    retry: 1,
  });
}
