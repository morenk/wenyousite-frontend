/** 删除楼层 API hook */

import { useMutation } from "@tanstack/react-query";
import { apiClient } from "@/api/client";

export function useDeletePost() {
  return useMutation({
    mutationFn: async (postId: string) => {
      const { error } = await apiClient.DELETE("/api/v1/posts/{id}", {
        params: { path: { id: postId } },
      });
      if (error) throw error;
    },
  });
}
