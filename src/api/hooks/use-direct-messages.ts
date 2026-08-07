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
import type { components, operations } from "@/api/types";

export type DirectMessage = components["schemas"]["DirectMessageResponseDto"];
type DirectMessagesResponse =
  operations["DirectConversationsController_messages"]["responses"][200]["content"]["application/json"];

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

  const messages = useMemo(() => {
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
  const updates = useQuery({
    queryKey: queryKeys.directMessages.updates(userId, conversationId, undefined),
    queryFn: async () => {
      if (!conversationId) return [] as DirectMessage[];
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
    enabled: !!conversationId && !!userId,
    refetchInterval: conversationId && userId ? 10_000 : false,
    refetchIntervalInBackground: false,
    staleTime: 0,
  });

  useEffect(() => {
    if (!conversationId || !updates.data?.length) return;
    appendDirectMessageToCache(queryClient, userId, conversationId, updates.data);
  }, [conversationId, queryClient, updates.data, userId]);

  return { ...history, messages, updatesError: updates.isError };
}
