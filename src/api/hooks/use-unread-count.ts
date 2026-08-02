/** 未读通知数量 API hook（GET /notifications/unread，30s 轮询） */

import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/api/client";

interface UnreadResponse {
  code: number;
  message: string;
  data: { unreadCount: number };
}

export function useUnreadCount(enabled = true) {
  return useQuery({
    queryKey: ["notifications", "unread"],
    queryFn: async () => {
      const { data, error } = await apiClient.GET("/api/v1/notifications/unread");
      if (error) throw error;
      const response = data as unknown as UnreadResponse;
      return response?.data?.unreadCount ?? 0;
    },
    enabled,
    refetchInterval: enabled ? 30 * 1000 : false,
    staleTime: 30 * 1000,
  });
}
