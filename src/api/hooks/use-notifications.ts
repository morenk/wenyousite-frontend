/** 通知列表 API hook（GET /notifications，cursor 分页，可选 type 过滤，按用户隔离缓存） */

import { useInfiniteQuery } from "@tanstack/react-query";
import { apiClient } from "@/api/client";

export interface NotificationFromUser {
  id: string;
  username: string;
  avatar: string | null;
  deletedAt?: string | null;
}

export interface NotificationItem {
  id: string;
  type: string;
  content: string | null;
  payload: Record<string, unknown> | null;
  postId: string | null;
  threadId: string | null;
  fromUserId: string | null;
  isRead: boolean;
  createdAt: string;
  post: {
    id: string;
    floorNumber: number | null;
    parentPostId: string | null;
    deletedAt?: string | null;
  } | null;
  thread: { id: string; title: string; deletedAt?: string | null } | null;
  fromUser: NotificationFromUser | null;
}

export interface NotificationsResponse {
  code: number;
  message: string;
  data: NotificationItem[];
  meta: { cursor: string | null; hasMore: boolean };
}

interface UseNotificationsParams {
  type?: string;
  userId?: string;
}

export function useNotifications({ type, userId }: UseNotificationsParams = {}) {
  const enabled = !!userId;
  return useInfiniteQuery({
    queryKey: ["notifications", type, userId],
    queryFn: async ({ pageParam }: { pageParam: string | undefined }) => {
      const queryParams: Record<string, string> = { limit: "20" };
      if (pageParam) queryParams.cursor = pageParam;
      if (type) queryParams.type = type;

      const { data, error } = await apiClient.GET("/api/v1/notifications", {
        params: { query: queryParams },
      });
      if (error) throw error;

      const response = data as unknown as NotificationsResponse;
      if (!response?.data) {
        return {
          code: 0,
          message: "ok",
          data: [],
          meta: { cursor: null, hasMore: false },
        } as NotificationsResponse;
      }
      return response;
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => {
      if (!lastPage?.meta?.hasMore) return undefined;
      return lastPage.meta.cursor ?? undefined;
    },
    enabled,
    staleTime: 10 * 1000,
  });
}
