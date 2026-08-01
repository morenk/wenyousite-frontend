/** 我的订阅列表 API hook */

import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/api/client";

export interface Subscription {
  id: string;
  userId: string;
  threadId: string;
  type: "THREAD" | "USER";
  targetUserId: string | null;
  createdAt: string;
  thread: {
    id: string;
    title: string;
  };
}

interface SubscriptionsResponse {
  code: number;
  message: string;
  data: Subscription[];
}

export function useSubscriptions(enabled = true) {
  return useQuery({
    queryKey: ["subscriptions"],
    queryFn: async () => {
      const { data, error } = await apiClient.GET("/api/v1/subscriptions");
      if (error) throw error;
      return (data as unknown as SubscriptionsResponse).data;
    },
    enabled,
    staleTime: 10 * 1000,
  });
}
