/** 我的订阅列表 API hook */

import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/api/client";
import { queryKeys } from "@/api/query-keys";
import type { components } from "@/api/types";

export type Subscription = components["schemas"]["SubscriptionResponseDto"];

export function useSubscriptions(enabled = true) {
  return useQuery({
    queryKey: queryKeys.subscriptions,
    queryFn: async () => {
      const { data, error } = await apiClient.GET("/api/v1/subscriptions");
      if (error) throw error;
      if (!data) throw new Error("订阅列表响应为空");
      return data.data;
    },
    enabled,
    staleTime: 10 * 1000,
  });
}
