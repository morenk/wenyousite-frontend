/** 收藏夹分类查询、新建与移动操作。 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/api/client";
import { queryKeys } from "@/api/query-keys";
import type { components } from "@/api/types";

export type BookmarkFolder = components["schemas"]["BookmarkFolderResponseDto"];

export function useBookmarkFolders() {
  return useQuery({
    queryKey: queryKeys.bookmarks.folders,
    queryFn: async () => {
      const { data, error } = await apiClient.GET("/api/v1/bookmarks/folders");
      if (error) throw error;
      return data?.data ?? [];
    },
    staleTime: 30 * 1000,
  });
}

export function useCreateBookmarkFolder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (name: string) => {
      const { data, error } = await apiClient.POST("/api/v1/bookmarks/folders", {
        body: { name },
      });
      if (error) throw error;
      if (!data?.data) throw new Error("新建收藏夹响应为空");
      return data.data;
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: queryKeys.bookmarks.folders }),
  });
}

export function useMoveBookmark() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ bookmarkId, folderId }: { bookmarkId: string; folderId: string }) => {
      const { error } = await apiClient.PATCH("/api/v1/bookmarks/{id}", {
        params: { path: { id: bookmarkId } },
        body: { folderId },
      });
      if (error) throw error;
    },
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.bookmarks.all }),
        queryClient.invalidateQueries({ queryKey: queryKeys.bookmarks.folders }),
        queryClient.invalidateQueries({ queryKey: queryKeys.users.bookmarks() }),
      ]),
  });
}
