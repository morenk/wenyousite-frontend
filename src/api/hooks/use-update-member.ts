/** 更新参与人角色/玩家标记 API hook */

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/api/client";
import { queryKeys } from "@/api/query-keys";
import type { ThreadMember } from "@/api/hooks/use-members";

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
    onMutate: async (variables) => {
      const memberKey = queryKeys.members.list(variables.threadId);
      await queryClient.cancelQueries({ queryKey: memberKey });
      const previousMembers = queryClient.getQueryData<ThreadMember[]>(memberKey);
      queryClient.setQueryData<ThreadMember[]>(memberKey, (current) =>
        current?.map((member) => member.userId === variables.userId
          ? {
              ...member,
              ...(variables.role !== undefined ? { role: variables.role } : {}),
              ...(variables.playerMarked !== undefined
                ? { playerMarked: variables.playerMarked }
                : {}),
            }
          : member),
      );
      return { previousMembers };
    },
    onError: (_error, variables, context) => {
      if (context?.previousMembers) {
        queryClient.setQueryData(
          queryKeys.members.list(variables.threadId),
          context.previousMembers,
        );
      }
    },
    onSettled: (_data, _error, variables) =>
      Promise.all([
        queryClient.invalidateQueries({
          queryKey: queryKeys.members.list(variables.threadId),
        }),
        queryClient.invalidateQueries({
          queryKey: queryKeys.threads.detail(variables.threadId),
        }),
        ...(variables.playerMarked === undefined
          ? []
          : [queryClient.invalidateQueries({ queryKey: queryKeys.users.all })]),
      ]),
  });
}
