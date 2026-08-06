/** 收藏/取消收藏 API hooks（POST /bookmarks + DELETE /bookmarks/:id） */

import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { QueryClient } from "@tanstack/react-query";
import { apiClient } from "@/api/client";
import { queryKeys } from "@/api/query-keys";

function invalidateBookmarkQueries(queryClient: QueryClient, threadId: string) {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: queryKeys.bookmarks.all }),
    queryClient.invalidateQueries({ queryKey: queryKeys.users.bookmarks() }),
    queryClient.invalidateQueries({ queryKey: queryKeys.threads.detail(threadId) }),
  ]);
}

export function useRemoveBookmark() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ bookmarkId }: { bookmarkId: string; threadId: string }) => {
      const { error } = await apiClient.DELETE("/api/v1/bookmarks/{id}", {
        params: { path: { id: bookmarkId } },
      });
      if (error) throw error;
    },
    onSuccess: (_data, { threadId }) =>
      invalidateBookmarkQueries(queryClient, threadId),
  });
}

export function useBookmarkActions(threadId: string) {
  const queryClient = useQueryClient();

  const invalidate = () => {
    return invalidateBookmarkQueries(queryClient, threadId);
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
