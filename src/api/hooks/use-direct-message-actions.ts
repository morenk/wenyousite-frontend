import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/api/client";
import { queryKeys } from "@/api/query-keys";
import { appendDirectMessageToCache } from "@/api/hooks/use-direct-messages";

interface MessageInput {
  content?: string;
  mediaId?: string;
  clientRequestId: string;
}

export function useStartDirectConversation(userId?: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: MessageInput & { recipientId: string }) => {
      const { data, error } = await apiClient.POST("/api/v1/direct-conversations", {
        body: input,
      });
      if (error) throw error;
      if (!data) throw new Error("发起私聊响应为空");
      return data.data;
    },
    onSuccess: (result) => {
      appendDirectMessageToCache(
        queryClient,
        userId,
        result.conversation.id,
        [result.message],
      );
      queryClient.invalidateQueries({ queryKey: queryKeys.directMessages.all });
    },
  });
}

export function useDirectMessageActions(conversationId: string, userId?: string) {
  const queryClient = useQueryClient();
  const invalidateConversation = () => {
    queryClient.invalidateQueries({
      queryKey: queryKeys.directMessages.conversation(userId, conversationId),
    });
    queryClient.invalidateQueries({ queryKey: queryKeys.directMessages.lists(userId) });
    queryClient.invalidateQueries({ queryKey: queryKeys.directMessages.unread(userId) });
  };

  const send = useMutation({
    mutationFn: async (input: MessageInput) => {
      const { data, error } = await apiClient.POST(
        "/api/v1/direct-conversations/{id}/messages",
        { params: { path: { id: conversationId } }, body: input },
      );
      if (error) throw error;
      if (!data) throw new Error("发送消息响应为空");
      return data.data;
    },
    onSuccess: (message) => {
      appendDirectMessageToCache(queryClient, userId, conversationId, [message]);
      invalidateConversation();
    },
  });

  const handleRequest = useMutation({
    mutationFn: async (action: "ACCEPT" | "DECLINE") => {
      const { data, error } = await apiClient.PATCH(
        "/api/v1/direct-conversations/{id}/request",
        { params: { path: { id: conversationId } }, body: { action } },
      );
      if (error) throw error;
      if (!data) throw new Error("处理消息请求响应为空");
      return data.data;
    },
    onSuccess: invalidateConversation,
  });

  const setArchived = useMutation({
    mutationFn: async (archived: boolean) => {
      const { data, error } = await apiClient.PATCH(
        "/api/v1/direct-conversations/{id}/archive",
        { params: { path: { id: conversationId } }, body: { archived } },
      );
      if (error) throw error;
      if (!data) throw new Error("归档响应为空");
      return data.data;
    },
    onSuccess: invalidateConversation,
  });

  const markRead = useMutation({
    mutationFn: async (throughMessageId: string) => {
      const { error } = await apiClient.POST(
        "/api/v1/direct-conversations/{id}/read",
        { params: { path: { id: conversationId } }, body: { throughMessageId } },
      );
      if (error) throw error;
    },
    onSuccess: invalidateConversation,
  });

  const recall = useMutation({
    mutationFn: async (messageId: string) => {
      const { data, error } = await apiClient.DELETE("/api/v1/direct-messages/{id}", {
        params: { path: { id: messageId } },
      });
      if (error) throw error;
      if (!data) throw new Error("撤回响应为空");
      return data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.directMessages.messages(userId, conversationId),
      });
      invalidateConversation();
    },
  });

  return { send, handleRequest, setArchived, markRead, recall };
}
