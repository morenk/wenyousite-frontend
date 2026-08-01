/** 更新参与人角色/玩家标记 API hook */

import { useMutation } from "@tanstack/react-query";
import { apiClient } from "@/api/client";

interface UpdateMemberArgs {
  threadId: string;
  userId: string;
  role?: "COLLABORATOR" | "PARTICIPANT";
  playerMarked?: boolean;
}

export function useUpdateMember() {
  return useMutation({
    mutationFn: async ({ threadId, userId, role, playerMarked }: UpdateMemberArgs) => {
      const { data, error } = await apiClient.PATCH(
        "/api/v1/threads/{threadId}/members/{userId}",
        {
          params: { path: { threadId, userId } },
          body: { role, playerMarked },
        },
      );
      if (error) throw error;
      return data;
    },
  });
}
