import { useEffect, useMemo } from "react";
import {
  type InfiniteData,
  type QueryClient,
  useInfiniteQuery,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { apiClient } from "@/api/client";
import { queryKeys } from "@/api/query-keys";
import type { operations } from "@/api/types";
import type { DirectMessage } from "@/lib/direct-message";

export type { DirectMessage } from "@/lib/direct-message";
type DirectMessagesResponse =
  operations["directConversationsMessages"]["responses"][200]["content"]["application/json"];

export function appendDirectMessageToCache(
  queryClient: QueryClient,
  userId: string | undefined,
  conversationId: string,
  incoming: DirectMessage[],
) {
  if (incoming.length === 0) return;
  queryClient.setQueryData<InfiniteData<DirectMessagesResponse, string | undefined>>(
    queryKeys.directMessages.messages(userId, conversationId),
    (current) => {
      if (!current || current.pages.length === 0) return current;
      const incomingById = new Map(incoming.map((item) => [item.id, item]));
      const known = new Set(current.pages.flatMap((page) => page.data.map((item) => item.id)));
      const next = [...incomingById.values()].filter((item) => !known.has(item.id));
      const pages = current.pages.map((page) => ({
        ...page,
        data: page.data.map((item) => incomingById.get(item.id) ?? item),
      }));
      pages[0] = { ...pages[0], data: [...pages[0].data, ...next] };
      return { ...current, pages };
    },
  );
}

export function removeDirectMessageFromCache(
  queryClient: QueryClient,
  userId: string | undefined,
  conversationId: string,
  messageId: string,
) {
  queryClient.setQueryData<InfiniteData<DirectMessagesResponse, string | undefined>>(
    queryKeys.directMessages.messages(userId, conversationId),
    (current) => current && ({
      ...current,
      pages: current.pages.map((page) => ({
        ...page,
        data: page.data.filter((message) => message.id !== messageId),
      })),
    }),
  );
}

export function replaceDirectMessageInCache(
  queryClient: QueryClient,
  userId: string | undefined,
  conversationId: string,
  messageId: string,
  replacement: DirectMessage,
) {
  queryClient.setQueryData<InfiniteData<DirectMessagesResponse, string | undefined>>(
    queryKeys.directMessages.messages(userId, conversationId),
    (current) => {
      if (!current || current.pages.length === 0) return current;
      let replaced = false;
      const pages = current.pages.map((page) => ({
        ...page,
        data: page.data.flatMap((message) => {
          if (message.id === replacement.id) return [];
          if (message.id !== messageId) return [message];
          replaced = true;
          return [replacement];
        }),
      }));
      if (!replaced) pages[0] = { ...pages[0], data: [...pages[0].data, replacement] };
      return { ...current, pages };
    },
  );
}

export function useDirectMessages(conversationId?: string, userId?: string) {
  const queryClient = useQueryClient();
  const history = useInfiniteQuery({
    queryKey: queryKeys.directMessages.messages(userId, conversationId),
    queryFn: async ({ pageParam }: { pageParam: string | undefined }) => {
      if (!conversationId) throw new Error("缺少会话 ID");
      const { data, error } = await apiClient.GET(
        "/api/v1/direct-conversations/{id}/messages",
        {
          params: {
            path: { id: conversationId },
            query: { limit: 30, ...(pageParam ? { cursor: pageParam } : {}) },
          },
        },
      );
      if (error) throw error;
      if (!data) throw new Error("消息历史响应为空");
      return data;
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) =>
      lastPage.meta?.hasMore ? lastPage.meta.cursor ?? undefined : undefined,
    enabled: !!conversationId && !!userId,
    staleTime: 10_000,
  });

  const messages = useMemo<DirectMessage[]>(() => {
    const pages = history.data?.pages ?? [];
    const seen = new Set<string>();
    return [...pages]
      .reverse()
      .flatMap((page) => page.data)
      .filter((message) => {
        if (seen.has(message.id)) return false;
        seen.add(message.id);
        return true;
      });
  }, [history.data?.pages]);
  const latestMessageId = messages.findLast((message) => message.deliveryState !== "sending")?.id;
  const updates = useQuery({
    // The cursor is part of the query identity: once a batch is merged, start a
    // fresh request from the new tail instead of reusing data fetched for an old tail.
    queryKey: queryKeys.directMessages.updates(userId, conversationId, latestMessageId),
    queryFn: async () => {
      if (!conversationId || !latestMessageId) {
        throw new Error("缺少增量消息游标");
      }
      const { data, error } = await apiClient.GET(
        "/api/v1/direct-conversations/{id}/messages",
        {
          params: {
            path: { id: conversationId },
            query: { limit: 50, after: latestMessageId },
          },
        },
      );
      if (error) throw error;
      if (!data) throw new Error("增量消息响应为空");
      return data;
    },
    enabled: history.isSuccess && !!conversationId && !!userId && !!latestMessageId,
    refetchInterval: (query) => query.state.data?.meta?.hasMore ? 1_000 : 10_000,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: "always",
    staleTime: 0,
  });

  // after 只返回新消息，不能感知旧消息被对方撤回；低频刷新最近一页用于状态对账。
  const reconciliation = useQuery({
    queryKey: queryKeys.directMessages.reconciliation(userId, conversationId),
    queryFn: async () => {
      if (!conversationId) throw new Error("缺少会话 ID");
      const { data, error } = await apiClient.GET(
        "/api/v1/direct-conversations/{id}/messages",
        {
          params: {
            path: { id: conversationId },
            query: { limit: 50 },
          },
        },
      );
      if (error) throw error;
      return data?.data ?? [];
    },
    enabled: history.isSuccess && !!conversationId && !!userId,
    initialData: [] as DirectMessage[],
    staleTime: 60_000,
    refetchInterval: 60_000,
    refetchIntervalInBackground: false,
  });

  useEffect(() => {
    if (!conversationId || !updates.data?.data.length) return;
    appendDirectMessageToCache(queryClient, userId, conversationId, updates.data.data);
  }, [conversationId, queryClient, updates.data, userId]);

  useEffect(() => {
    if (!conversationId || reconciliation.data.length === 0) return;
    appendDirectMessageToCache(queryClient, userId, conversationId, reconciliation.data);
  }, [conversationId, queryClient, reconciliation.data, userId]);

  return {
    ...history,
    messages,
    refetchLatest: updates.refetch,
    updatesError: updates.isError || reconciliation.isError,
  };
}
