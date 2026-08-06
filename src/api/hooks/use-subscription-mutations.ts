/** 创建/取消订阅 API hook */

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/api/client";
import { queryKeys } from "@/api/query-keys";

export type CreateSubscriptionArgs =
  | { threadId: string; type: "THREAD" }
  | { threadId: string; type: "USER"; targetUserId: string };

export function useCreateSubscription() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (args: CreateSubscriptionArgs) => {
      const { threadId, type } = args;
      const { data, error } = await apiClient.POST("/api/v1/subscriptions", {
        body: {
          threadId,
          type,
          ...(type === "USER" ? { targetUserId: args.targetUserId } : {}),
        },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: queryKeys.subscriptions }),
  });
}

export function useDeleteSubscription() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (subscriptionId: string) => {
      const { data, error } = await apiClient.DELETE(
        "/api/v1/subscriptions/{id}",
        { params: { path: { id: subscriptionId } } },
      );
      if (error) throw error;
      return data;
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: queryKeys.subscriptions }),
  });
}
