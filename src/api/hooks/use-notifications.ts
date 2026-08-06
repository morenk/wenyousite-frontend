/** 通知列表 API hook（GET /notifications，cursor 分页，可选 type 过滤，按用户隔离缓存） */

import { useInfiniteQuery } from "@tanstack/react-query";
import { apiClient } from "@/api/client";
import { queryKeys } from "@/api/query-keys";
import type { components, operations } from "@/api/types";

type GeneratedNotificationItem =
  components["schemas"]["NotificationResponseDto"];
type NotificationPost = NonNullable<GeneratedNotificationItem["post"]>;
type NotificationThread = NonNullable<GeneratedNotificationItem["thread"]>;
type GeneratedNotificationFromUser = NonNullable<
  GeneratedNotificationItem["fromUser"]
>;
/** UI 不依赖接收者 ID 和服务端幂等键，组件只消费展示字段。 */
export type NotificationItem = Omit<
  GeneratedNotificationItem,
  "userId" | "eventKey" | "post" | "thread" | "fromUser"
> & {
  post: (Omit<NotificationPost, "deletedAt"> & {
    deletedAt?: NotificationPost["deletedAt"];
  }) | null;
  thread: (Omit<NotificationThread, "deletedAt"> & {
    deletedAt?: NotificationThread["deletedAt"];
  }) | null;
  fromUser: (Omit<GeneratedNotificationFromUser, "deletedAt"> & {
    deletedAt?: GeneratedNotificationFromUser["deletedAt"];
  }) | null;
};
export type NotificationFromUser = NonNullable<NotificationItem["fromUser"]>;
export type NotificationsResponse =
  operations["NotificationsController_findAll"]["responses"][200]["content"]["application/json"];

interface UseNotificationsParams {
  type?: string;
  userId?: string;
}

export function useNotifications({ type, userId }: UseNotificationsParams = {}) {
  const enabled = !!userId;
  return useInfiniteQuery({
    queryKey: queryKeys.notifications.list(type, userId),
    queryFn: async ({ pageParam }: { pageParam: string | undefined }) => {
      const queryParams: Record<string, string> = { limit: "20" };
      if (pageParam) queryParams.cursor = pageParam;
      if (type) queryParams.type = type;

      const { data, error } = await apiClient.GET("/api/v1/notifications", {
        params: { query: queryParams },
      });
      if (error) throw error;

      if (!data?.data) {
        return {
          code: 0,
          message: "ok",
          data: [],
          meta: { cursor: null, hasMore: false },
        } satisfies NotificationsResponse;
      }
      return data;
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
