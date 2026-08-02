/** 收藏/取消收藏 API hooks（POST /bookmarks + DELETE /bookmarks/:id） */

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/api/client";

export function useBookmarkActions(threadId: string) {
  const queryClient = useQueryClient();

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["bookmarks"] });
    queryClient.invalidateQueries({ queryKey: ["user", "bookmarks"] });
    queryClient.invalidateQueries({ queryKey: ["thread", threadId] });
  };

  const add = useMutation({
    mutationFn: async () => {
      const { error } = await apiClient.POST("/api/v1/bookmarks", {
        body: { threadId },
      });
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const remove = useMutation({
    mutationFn: async (bookmarkId: string) => {
      const { error } = await apiClient.DELETE("/api/v1/bookmarks/{id}", {
        params: { path: { id: bookmarkId } },
      });
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  return { add, remove };
}
