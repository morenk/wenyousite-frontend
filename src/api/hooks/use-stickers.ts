"use client";

import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/api/client";
import { queryKeys } from "@/api/query-keys";
import type { components } from "@/api/types";

export type UserSticker = components["schemas"]["UserStickerResponseDto"];
export type StickerImport = components["schemas"]["StickerImportResponseDto"];
export type StickerSource =
  | { directMessageId: string }
  | { postId: string; imageUrl: string };

const wait = (milliseconds: number) =>
  new Promise((resolve) => window.setTimeout(resolve, milliseconds));

async function waitForImport(id: string): Promise<StickerImport> {
  for (let attempt = 0; attempt < 45; attempt++) {
    const { data, error } = await apiClient.GET("/api/v1/stickers/imports/{id}", {
      params: { path: { id } },
    });
    if (error) throw error;
    if (!data) throw new Error("表情导入状态响应为空");
    if (data.data.status !== "PROCESSING") return data.data;
    await wait(1_000);
  }
  throw new Error("表情处理超时，请稍后重新打开面板查看");
}

/** 快速收藏不要求调用方位于 QueryClientProvider 内；面板通过事件刷新。 */
export async function saveStickerSource(source: StickerSource): Promise<StickerImport> {
  const response = "directMessageId" in source
    ? await apiClient.POST("/api/v1/stickers/imports/direct-message", {
        body: {
          directMessageId: source.directMessageId,
          clientRequestId: crypto.randomUUID(),
        },
      })
    : await apiClient.POST("/api/v1/stickers/imports/post-image", {
        body: {
          postId: source.postId,
          imageUrl: source.imageUrl,
          clientRequestId: crypto.randomUUID(),
        },
      });
  if (response.error) throw response.error;
  if (!response.data) throw new Error("表情收藏响应为空");
  return response.data.data;
}

export function useStickers(userId?: string) {
  const query = useQuery({
    queryKey: queryKeys.stickers(userId),
    queryFn: async () => {
      const { data, error } = await apiClient.GET("/api/v1/stickers");
      if (error) throw error;
      if (!data) throw new Error("表情收藏响应为空");
      return data.data;
    },
    enabled: !!userId,
    staleTime: 30_000,
    refetchInterval: (query) =>
      query.state.data?.pendingImports.length ? 2_000 : false,
  });
  const { refetch } = query;
  useEffect(() => {
    const refresh = () => void refetch();
    window.addEventListener("stickers:changed", refresh);
    return () => window.removeEventListener("stickers:changed", refresh);
  }, [refetch]);
  return query;
}

export function useStickerActions(userId?: string) {
  const queryClient = useQueryClient();
  const refresh = () => queryClient.invalidateQueries({ queryKey: queryKeys.stickers(userId) });
  const finishImport = async (result: StickerImport) => {
    const completed = result.status === "PROCESSING" ? await waitForImport(result.id) : result;
    await refresh();
    if (completed.status === "FAILED") {
      throw new Error(
        typeof completed.failureMessage === "string"
          ? completed.failureMessage
          : "表情处理失败",
      );
    }
    return completed;
  };

  const importMedia = useMutation({
    mutationFn: async (mediaId: string) => {
      const { data, error } = await apiClient.POST("/api/v1/stickers/imports/media", {
        body: { mediaId, clientRequestId: crypto.randomUUID() },
      });
      if (error) throw error;
      if (!data) throw new Error("表情导入响应为空");
      return finishImport(data.data);
    },
  });

  const importDirectMessage = useMutation({
    mutationFn: async (directMessageId: string) => {
      const { data, error } = await apiClient.POST(
        "/api/v1/stickers/imports/direct-message",
        { body: { directMessageId, clientRequestId: crypto.randomUUID() } },
      );
      if (error) throw error;
      if (!data) throw new Error("表情收藏响应为空");
      return finishImport(data.data);
    },
  });

  const importPostImage = useMutation({
    mutationFn: async ({ postId, imageUrl }: { postId: string; imageUrl: string }) => {
      const { data, error } = await apiClient.POST("/api/v1/stickers/imports/post-image", {
        body: { postId, imageUrl, clientRequestId: crypto.randomUUID() },
      });
      if (error) throw error;
      if (!data) throw new Error("表情收藏响应为空");
      return finishImport(data.data);
    },
  });

  const reorder = useMutation({
    mutationFn: async ({ version, favoriteIds }: { version: number; favoriteIds: string[] }) => {
      const { data, error } = await apiClient.PUT("/api/v1/stickers/reorder", {
        body: { version, favoriteIds },
      });
      if (error) throw error;
      if (!data) throw new Error("表情排序响应为空");
      return data.data;
    },
    onSuccess: (collection) => queryClient.setQueryData(queryKeys.stickers(userId), collection),
  });

  const remove = useMutation({
    mutationFn: async (favoriteId: string) => {
      const { data, error } = await apiClient.DELETE("/api/v1/stickers/{favoriteId}", {
        params: { path: { favoriteId } },
      });
      if (error) throw error;
      if (!data) throw new Error("移除表情响应为空");
      return data.data;
    },
    onSuccess: (collection) => queryClient.setQueryData(queryKeys.stickers(userId), collection),
  });

  return { importMedia, importDirectMessage, importPostImage, reorder, remove, refresh };
}
