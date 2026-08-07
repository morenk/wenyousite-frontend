/** 拉黑/取消拉黑 API hook（POST/DELETE /users/me/block/:id，无 body） */

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/api/client";
import { queryKeys } from "@/api/query-keys";

export function useBlockActions(userId: string) {
  const queryClient = useQueryClient();

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.users.detail(userId) });
    queryClient.invalidateQueries({ queryKey: queryKeys.directMessages.all });
  };

  const block = useMutation({
    mutationFn: async () => {
      const { error } = await apiClient.POST("/api/v1/users/me/block/{id}", {
        params: { path: { id: userId } },
      });
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const unblock = useMutation({
    mutationFn: async () => {
      const { error } = await apiClient.DELETE("/api/v1/users/me/block/{id}", {
        params: { path: { id: userId } },
      });
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  return { block, unblock };
}
