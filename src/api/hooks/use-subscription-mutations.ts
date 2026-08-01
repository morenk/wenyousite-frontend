/** 创建/取消订阅 API hook */

import { useMutation } from "@tanstack/react-query";
import { apiClient } from "@/api/client";

export function useCreateSubscription() {
  return useMutation({
    mutationFn: async ({ threadId, type }: { threadId: string; type: "THREAD" | "USER" }) => {
      const { data, error } = await apiClient.POST("/api/v1/subscriptions", {
        body: { threadId, type },
      });
      if (error) throw error;
      return data;
    },
  });
}

export function useDeleteSubscription() {
  return useMutation({
    mutationFn: async (subscriptionId: string) => {
      const { data, error } = await apiClient.DELETE(
        "/api/v1/subscriptions/{id}",
        { params: { path: { id: subscriptionId } } },
      );
      if (error) throw error;
      return data;
    },
  });
}
