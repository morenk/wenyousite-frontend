/** 删除楼层 API hook */

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/api/client";
import { queryKeys } from "@/api/query-keys";

export function useDeletePost() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (postId: string) => {
      const { error } = await apiClient.DELETE("/api/v1/posts/{id}", {
        params: { path: { id: postId } },
      });
      if (error) throw error;
    },
    onSuccess: (_data, postId) =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.floors.all }),
        queryClient.invalidateQueries({ queryKey: queryKeys.replies.all }),
        queryClient.invalidateQueries({ queryKey: queryKeys.posts.detail(postId) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.users.all }),
      ]),
  });
}
