/** 收藏夹分类查询、新建与移动操作。 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/api/client";
import { queryKeys } from "@/api/query-keys";
import type { components } from "@/api/types";

export type BookmarkFolderKind = "threads" | "moments";

export interface BookmarkFolder {
  id: string;
  name: string;
  isDefault: boolean;
  itemCount: number;
  createdAt: string;
}

function mapThreadFolder(
  folder: components["schemas"]["BookmarkFolderResponseDto"],
): BookmarkFolder {
  return {
    id: folder.id,
    name: folder.name,
    isDefault: folder.isDefault,
    itemCount: folder.bookmarkCount,
    createdAt: folder.createdAt,
  };
}

function mapMomentFolder(
  folder: components["schemas"]["MomentBookmarkFolderResponseDto"],
): BookmarkFolder {
  return {
    id: folder.id,
    name: folder.name,
    isDefault: folder.isDefault,
    itemCount: folder.momentBookmarkCount,
    createdAt: folder.createdAt,
  };
}

export function useBookmarkFolders(kind: BookmarkFolderKind = "threads", enabled = true) {
  return useQuery({
    queryKey: queryKeys.bookmarks.folders(kind),
    queryFn: async () => {
      if (kind === "moments") {
        const { data, error } = await apiClient.GET("/api/v1/moments/bookmark-folders");
        if (error) throw error;
        return (data?.data ?? []).map(mapMomentFolder);
      }
      const { data, error } = await apiClient.GET("/api/v1/bookmarks/folders");
      if (error) throw error;
      return (data?.data ?? []).map(mapThreadFolder);
    },
    staleTime: 30 * 1000,
    enabled,
  });
}

export function useCreateBookmarkFolder(kind: BookmarkFolderKind = "threads") {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (name: string) => {
      if (kind === "moments") {
        const { data, error } = await apiClient.POST("/api/v1/moments/bookmark-folders", {
          body: { name },
        });
        if (error) throw error;
        if (!data?.data) throw new Error("新建动态收藏夹响应为空");
        return mapMomentFolder(data.data);
      }
      const { data, error } = await apiClient.POST("/api/v1/bookmarks/folders", {
        body: { name },
      });
      if (error) throw error;
      if (!data?.data) throw new Error("新建主题帖收藏夹响应为空");
      return mapThreadFolder(data.data);
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: queryKeys.bookmarks.folders(kind) }),
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
        queryClient.invalidateQueries({ queryKey: queryKeys.bookmarks.folders("threads") }),
        queryClient.invalidateQueries({ queryKey: queryKeys.users.bookmarks() }),
      ]),
  });
}

export function useMoveMomentBookmark() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ momentId, folderId }: { momentId: string; folderId: string }) => {
      const { error } = await apiClient.PATCH("/api/v1/moments/{id}/bookmark", {
        params: { path: { id: momentId } },
        body: { folderId },
      });
      if (error) throw error;
    },
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.moments.bookmarksRoot }),
        queryClient.invalidateQueries({ queryKey: queryKeys.bookmarks.folders("moments") }),
      ]),
  });
}
