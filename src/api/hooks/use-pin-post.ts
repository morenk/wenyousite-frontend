/** 主楼层置顶 API hook */

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/api/client";
import { queryKeys } from "@/api/query-keys";

export function usePinPost() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ postId, pinned }: { postId: string; pinned: boolean }) => {
      const result = pinned
        ? await apiClient.POST("/api/v1/posts/{id}/pin", {
            params: { path: { id: postId } },
          })
        : await apiClient.DELETE("/api/v1/posts/{id}/pin", {
            params: { path: { id: postId } },
          });
      if (result.error) throw result.error;
      return result.data?.data;
    },
    onSuccess: (_data, variables) =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.floors.all }),
        queryClient.invalidateQueries({ queryKey: queryKeys.posts.detail(variables.postId) }),
      ]),
  });
}
