/** 通知操作 API hooks：标记已读 / 删除 / 全部已读 */

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/api/client";

function useInvalidateNotifications() {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({ queryKey: ["notifications"] });
  };
}

export function useNotificationActions() {
  const invalidate = useInvalidateNotifications();

  const markRead = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await apiClient.PATCH("/api/v1/notifications/{id}", {
        params: { path: { id } },
        body: { isRead: true },
      });
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await apiClient.DELETE("/api/v1/notifications/{id}", {
        params: { path: { id } },
      });
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const markAllRead = useMutation({
    mutationFn: async () => {
      const { error } = await apiClient.POST("/api/v1/notifications/read-all");
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  return { markRead, remove, markAllRead };
}
