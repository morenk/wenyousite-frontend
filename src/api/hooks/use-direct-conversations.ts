import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { apiClient } from "@/api/client";
import { queryKeys } from "@/api/query-keys";
import type { components } from "@/api/types";

export type DirectConversation = components["schemas"]["DirectConversationResponseDto"];
export type DirectConversationView = "INBOX" | "REQUESTS" | "ARCHIVED";

interface DirectConversationQueryOptions {
  enabled?: boolean;
  poll?: boolean;
}

export function useDirectConversations(
  view: DirectConversationView,
  userId?: string,
  options: DirectConversationQueryOptions = {},
) {
  return useInfiniteQuery({
    queryKey: queryKeys.directMessages.list(userId, view),
    queryFn: async ({ pageParam }: { pageParam: string | undefined }) => {
      const { data, error } = await apiClient.GET("/api/v1/direct-conversations", {
        params: {
          query: {
            view,
            limit: 20,
            ...(pageParam ? { cursor: pageParam } : {}),
          },
        },
      });
      if (error) throw error;
      if (!data) throw new Error("会话列表响应为空");
      return data;
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) =>
      lastPage.meta?.hasMore ? lastPage.meta.cursor ?? undefined : undefined,
    enabled: !!userId && options.enabled !== false,
    staleTime: 10_000,
    refetchInterval: userId && options.poll !== false ? 30_000 : false,
    refetchIntervalInBackground: false,
  });
}

export function useDirectUnreadCount(userId?: string) {
  return useQuery({
    queryKey: queryKeys.directMessages.unread(userId),
    queryFn: async () => {
      const { data, error } = await apiClient.GET("/api/v1/direct-conversations/unread");
      if (error) throw error;
      return data?.data ?? { unreadMessageCount: 0, pendingRequestCount: 0, total: 0 };
    },
    enabled: !!userId,
    staleTime: 30_000,
    refetchInterval: userId ? 30_000 : false,
    refetchIntervalInBackground: false,
  });
}

export function useDirectConversation(conversationId?: string, userId?: string) {
  return useQuery({
    queryKey: queryKeys.directMessages.conversation(userId, conversationId),
    queryFn: async () => {
      if (!conversationId) throw new Error("缺少会话 ID");
      const { data, error } = await apiClient.GET("/api/v1/direct-conversations/{id}", {
        params: { path: { id: conversationId } },
      });
      if (error) throw error;
      if (!data) throw new Error("会话不存在");
      return data.data;
    },
    enabled: !!conversationId && !!userId,
    staleTime: 10_000,
    refetchInterval: conversationId && userId ? 30_000 : false,
    refetchIntervalInBackground: false,
  });
}

export function useDirectConversationLookup(otherUserId?: string, userId?: string) {
  return useQuery({
    queryKey: queryKeys.directMessages.lookup(userId, otherUserId),
    queryFn: async () => {
      if (!otherUserId) throw new Error("缺少目标用户 ID");
      const { data, error } = await apiClient.GET(
        "/api/v1/direct-conversations/by-user/{userId}",
        { params: { path: { userId: otherUserId } } },
      );
      if (error) throw error;
      if (!data) throw new Error("联系状态响应为空");
      return data.data;
    },
    enabled: !!otherUserId && !!userId,
    staleTime: 10_000,
  });
}
