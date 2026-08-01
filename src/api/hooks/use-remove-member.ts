/** 移除参与人/收回玩家标记 API hook */

import { useMutation } from "@tanstack/react-query";
import { apiClient } from "@/api/client";

export function useRemoveMember() {
  return useMutation({
    mutationFn: async ({
      threadId,
      userId,
    }: {
      threadId: string;
      userId: string;
    }) => {
      const { data, error } = await apiClient.DELETE(
        "/api/v1/threads/{threadId}/members/{userId}",
        { params: { path: { threadId, userId } } },
      );
      if (error) throw error;
      return data;
    },
  });
}
