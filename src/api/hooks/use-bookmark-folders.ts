/** 收藏夹分类查询、新建、重命名、删除与移动操作。 */

import { useMutation, useQuery, useQueryClient, type InfiniteData } from "@tanstack/react-query";
import { apiClient } from "@/api/client";
import { queryKeys } from "@/api/query-keys";
import type { components } from "@/api/types";
import type { BookmarksResponse } from "@/api/hooks/use-bookmarks";

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
    onSuccess: (folder) => {
      const queryKey = queryKeys.bookmarks.folders(kind);
      // 资料页新建时目录查询可能未挂载；先补齐旧缓存，避免跳转后误判新夹 URL 无效。
      queryClient.setQueryData<BookmarkFolder[]>(queryKey, (folders) =>
        folders ? [...folders.filter((item) => item.id !== folder.id), folder] : undefined,
      );
      return queryClient.invalidateQueries({ queryKey });
    },
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

function privateLists(kind: BookmarkFolderKind, viewerScope: string) {
  const root = kind === "threads" ? queryKeys.bookmarks.lists : queryKeys.moments.bookmarksRoot;
  return {
    queryKey: root,
    predicate: (query: { queryKey: readonly unknown[] }) =>
      kind === "threads" || query.queryKey[2] === viewerScope,
  };
}

export function useRenameBookmarkFolder(kind: BookmarkFolderKind, viewerScope = "anonymous") {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      const options = { params: { path: { id } }, body: { name: name.trim() } };
      if (kind === "moments") {
        const { data, error } = await apiClient.PATCH("/api/v1/moments/bookmark-folders/{id}", options);
        if (error) throw error;
        if (!data?.data) throw new Error("重命名动态收藏夹响应为空");
        return mapMomentFolder(data.data);
      }
      const { data, error } = await apiClient.PATCH("/api/v1/bookmarks/folders/{id}", options);
      if (error) throw error;
      if (!data?.data) throw new Error("重命名主题帖收藏夹响应为空");
      return mapThreadFolder(data.data);
    },
    onSuccess: async (folder) => {
      const queryKey = queryKeys.bookmarks.folders(kind);
      await client.cancelQueries({ queryKey, exact: true });
      client.setQueryData<BookmarkFolder[]>(queryKey, (folders) =>
        folders?.map((item) => item.id === folder.id ? folder : item),
      );
      // 列表只存稳定的 folderId，名称通过目录缓存解析；不修改其他类型和公开列表。
      void client.invalidateQueries({ queryKey, exact: true });
      void client.invalidateQueries(privateLists(kind, viewerScope));
    },
  });
}

type PrivateBookmarkPage = BookmarksResponse | components["schemas"]["MomentsBookmarks200Response"];
type PrivateBookmarkPages = InfiniteData<PrivateBookmarkPage>;

export function useDeleteBookmarkFolder(kind: BookmarkFolderKind, viewerScope = "anonymous") {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const options = { params: { path: { id } } };
      const { data, error } = kind === "moments"
        ? await apiClient.DELETE("/api/v1/moments/bookmark-folders/{id}", options)
        : await apiClient.DELETE("/api/v1/bookmarks/folders/{id}", options);
      if (error) throw error;
      if (!data?.data) throw new Error("删除收藏夹响应为空");
      return data.data;
    },
    onSuccess: async ({ deletedFolderId, destinationFolderId }) => {
      const queryKey = queryKeys.bookmarks.folders(kind);
      const lists = privateLists(kind, viewerScope);
      await Promise.all([client.cancelQueries({ queryKey, exact: true }), client.cancelQueries(lists)]);
      client.setQueryData<BookmarkFolder[]>(queryKey, (folders) => {
        const count = folders?.find((item) => item.id === deletedFolderId)?.itemCount ?? 0;
        return folders?.filter((item) => item.id !== deletedFolderId).map((item) =>
          item.id === destinationFolderId ? { ...item, itemCount: item.itemCount + count } : item,
        );
      });
      const listKey = (id?: string) => kind === "threads"
        ? queryKeys.bookmarks.list(id) : queryKeys.moments.bookmarks(viewerScope, id);
      // 将已加载的收藏元数据迁往默认夹；后台重取负责服务端排序、未加载记录和最终计数。
      const source = client.getQueryData<PrivateBookmarkPages>(listKey(deletedFolderId));
      const all = client.getQueryData<PrivateBookmarkPages>(listKey());
      const loadedPages = [...(all?.pages ?? []), ...(source?.pages ?? [])];
      const moved = new Map(loadedPages.flatMap<PrivateBookmarkPage["data"][number]>((page) => page.data)
        .filter((item) => item.bookmarkFolderId === deletedFolderId)
        .map((item) => [item.id, { ...item, bookmarkFolderId: destinationFolderId }]));
      client.setQueriesData<PrivateBookmarkPages>(lists, (cached) => cached && ({
        ...cached,
        pages: cached.pages.map((page) => ({ ...page, data: page.data.map((item) =>
          item.bookmarkFolderId === deletedFolderId ? { ...item, bookmarkFolderId: destinationFolderId } : item,
        ) } as PrivateBookmarkPage)),
      }));
      const destinationKey = listKey(destinationFolderId);
      const destination = client.getQueryData<PrivateBookmarkPages>(destinationKey);
      const template = destination?.pages[0] ?? source?.pages[0] ?? all?.pages[0];
      if (template) {
        const known = new Map([...(destination?.pages ?? []), ...(all?.pages ?? [])]
          .flatMap<PrivateBookmarkPage["data"][number]>((page) => page.data)
          .filter((item) => item.bookmarkFolderId === destinationFolderId).map((item) => [item.id, item]));
        for (const [id, item] of moved) known.set(id, item);
        // 合并后旧 cursor 已不能覆盖迁入记录；保留已知内容，等待后台从首页恢复分页。
        client.setQueryData<PrivateBookmarkPages>(destinationKey, {
          pages: [{ ...template, data: [...known.values()], meta: { cursor: null, hasMore: false } } as PrivateBookmarkPage],
          pageParams: [undefined],
        });
      }
      client.removeQueries({ queryKey: listKey(deletedFolderId), exact: true });
      void client.invalidateQueries({ queryKey, exact: true });
      void client.invalidateQueries(lists);
    },
  });
}
