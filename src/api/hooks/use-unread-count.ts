/** 未读通知数量 API hook（GET /notifications/unread，30s 轮询，按用户隔离缓存） */

import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/api/client";
import { queryKeys } from "@/api/query-keys";

export function useUnreadCount(userId?: string) {
  const enabled = !!userId;
  return useQuery({
    queryKey: queryKeys.notifications.unread(userId),
    queryFn: async () => {
      const { data, error } = await apiClient.GET("/api/v1/notifications/unread");
      if (error) throw error;
      return data?.data.unreadCount ?? 0;
    },
    enabled,
    refetchInterval: enabled ? 30 * 1000 : false,
    staleTime: 30 * 1000,
  });
}
