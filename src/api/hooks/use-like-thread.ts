/** 点赞/取消点赞主题帖 API hook */

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/api/client";

export function useLikeThread(threadId: string) {
  const queryClient = useQueryClient();

  const like = useMutation({
    mutationFn: async () => {
      const { error } = await apiClient.POST("/api/v1/threads/{id}/like", {
        params: { path: { id: threadId } },
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["thread", threadId] });
    },
  });

  const unlike = useMutation({
    mutationFn: async () => {
      const { error } = await apiClient.DELETE("/api/v1/threads/{id}/like", {
        params: { path: { id: threadId } },
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["thread", threadId] });
    },
  });

  return { like, unlike };
}
