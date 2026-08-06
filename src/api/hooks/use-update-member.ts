/** 更新参与人角色/玩家标记 API hook */

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/api/client";
import { queryKeys } from "@/api/query-keys";

interface UpdateMemberArgs {
  threadId: string;
  userId: string;
  role?: "COLLABORATOR" | "PARTICIPANT";
  playerMarked?: boolean;
}

export function useUpdateMember() {
  const queryClient = useQueryClient();
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
    onSuccess: (_data, variables) =>
      Promise.all([
        queryClient.invalidateQueries({
          queryKey: queryKeys.members.list(variables.threadId),
        }),
        queryClient.invalidateQueries({
          queryKey: queryKeys.threads.detail(variables.threadId),
        }),
      ]),
  });
}
