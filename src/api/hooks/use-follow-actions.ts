/** 关注/取消关注 API hook（POST/DELETE /users/follow/:id，无 body） */

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/api/client";

export function useFollowActions(userId: string) {
  const queryClient = useQueryClient();

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["user", userId] });
  };

  const follow = useMutation({
    mutationFn: async () => {
      const { error } = await apiClient.POST("/api/v1/users/follow/{id}", {
        params: { path: { id: userId } },
      });
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const unfollow = useMutation({
    mutationFn: async () => {
      const { error } = await apiClient.DELETE("/api/v1/users/follow/{id}", {
        params: { path: { id: userId } },
      });
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  return { follow, unfollow };
}
