/** 通知操作 API hooks：标记已读 / 删除 / 全部已读 */

import { useMutation, useQueryClient, type InfiniteData } from "@tanstack/react-query";
import { apiClient } from "@/api/client";
import { useAuth } from "@/lib/auth";
import type { NotificationsResponse } from "@/api/hooks/use-notifications";

type NotificationCacheSnapshot = Array<[readonly unknown[], unknown]>;

function useInvalidateNotifications() {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({ queryKey: ["notifications"] });
  };
}

export function useNotificationActions() {
  const invalidate = useInvalidateNotifications();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const isCurrentUserNotificationKey = (queryKey: readonly unknown[]) =>
    queryKey[0] === "notifications" && queryKey[2] === user?.id;

  const snapshot = (): NotificationCacheSnapshot =>
    queryClient.getQueriesData({ queryKey: ["notifications"] }).filter(
      ([queryKey]) => isCurrentUserNotificationKey(queryKey),
    );

  const restore = (snapshots: NotificationCacheSnapshot | undefined) => {
    snapshots?.forEach(([queryKey, data]) => queryClient.setQueryData(queryKey, data));
  };

  const updateNotificationLists = (update: (notification: { id: string; isRead: boolean }) => { id: string; isRead: boolean }) => {
    queryClient.setQueriesData<InfiniteData<NotificationsResponse>>(
      { predicate: (query) => isCurrentUserNotificationKey(query.queryKey) && query.queryKey[1] !== "unread" },
      (cached) => cached
        ? {
            ...cached,
            pages: cached.pages.map((page) => ({
              ...page,
              data: page.data.map((notification) => ({ ...notification, ...update(notification) })),
            })),
          }
        : cached,
    );
  };

  const markRead = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await apiClient.PATCH("/api/v1/notifications/{id}", {
        params: { path: { id } },
        body: { isRead: true },
      });
      if (error) throw error;
    },
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: ["notifications"] });
      const snapshots = snapshot();
      updateNotificationLists((notification) => notification.id === id ? { ...notification, isRead: true } : notification);
      queryClient.setQueriesData<number>(
        { predicate: (query) => isCurrentUserNotificationKey(query.queryKey) && query.queryKey[1] === "unread" },
        (count) => Math.max(0, (count ?? 0) - 1),
      );
      return { snapshots };
    },
    onError: (_error, _id, context) => restore(context?.snapshots),
    onSettled: invalidate,
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
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: ["notifications"] });
      const snapshots = snapshot();
      updateNotificationLists((notification) => ({ ...notification, isRead: true }));
      queryClient.setQueriesData<number>(
        { predicate: (query) => isCurrentUserNotificationKey(query.queryKey) && query.queryKey[1] === "unread" },
        () => 0,
      );
      return { snapshots };
    },
    onError: (_error, _variables, context) => restore(context?.snapshots),
    onSettled: invalidate,
  });

  return { markRead, remove, markAllRead };
}
