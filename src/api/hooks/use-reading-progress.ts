/** 阅读进度 API hooks：记录进度 + 新回复数 */

import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/api/client";
import { queryKeys } from "@/api/query-keys";
import type { components } from "@/api/types";

export const readingProgressKeys = {
  newReplies: queryKeys.newReplies,
  threadNewReplies: queryKeys.threadNewReplies,
};

/** 记录阅读进度（精确到楼层/楼中楼） */
export function useUpdateReadingProgress() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      subthreadId,
      postId,
    }: {
      threadId: string;
      subthreadId: string;
      postId?: string;
    }) => {
      const { data, error } = await apiClient.POST("/api/v1/reading-progress", {
        body: { subthreadId, postId },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: async (_data, { threadId, subthreadId }) => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: readingProgressKeys.newReplies(subthreadId),
        }),
        queryClient.invalidateQueries({
          queryKey: readingProgressKeys.threadNewReplies(threadId),
        }),
      ]);
    },
  });
}

/** 楼层查询完成后记录页面已经加载到的阅读位置。 */
export function useRecordLoadedReadingProgress({
  threadId,
  subthreadId,
  postId,
  ready,
}: {
  threadId: string;
  subthreadId: string | undefined;
  postId: string | undefined;
  ready: boolean;
}) {
  const { mutate } = useUpdateReadingProgress();

  useEffect(() => {
    if (!ready || !subthreadId) return;
    mutate({ threadId, subthreadId, postId });
  }, [mutate, postId, ready, subthreadId, threadId]);
}

export type NewRepliesInfo = components["schemas"]["NewRepliesResponseDto"];

/** 自上次阅读后子贴新增回复数 */
export function useNewReplies(subthreadId: string | undefined, enabled = true) {
  return useQuery({
    queryKey: readingProgressKeys.newReplies(subthreadId ?? ""),
    queryFn: async () => {
      if (!subthreadId) throw new Error("缺少子贴 ID");
      const { data, error } = await apiClient.GET("/api/v1/reading-progress/new-replies", {
        params: { query: { subthreadId } },
      });
      if (error) throw error;
      if (!data) throw new Error("新增回复响应为空");
      return data.data;
    },
    enabled: !!subthreadId && enabled,
    staleTime: 10 * 1000,
  });
}

/** 一次查询主题帖下全部子贴的新回复摘要。 */
export function useThreadNewReplies(threadId: string | undefined, enabled = true) {
  return useQuery({
    queryKey: readingProgressKeys.threadNewReplies(threadId ?? ""),
    queryFn: async () => {
      if (!threadId) throw new Error("缺少主题帖 ID");
      const { data, error } = await apiClient.GET(
        "/api/v1/reading-progress/threads/{threadId}/new-replies",
        { params: { path: { threadId } } },
      );
      if (error) throw error;
      if (!data) throw new Error("主题帖新增回复响应为空");
      return data.data;
    },
    enabled: !!threadId && enabled,
    staleTime: 10 * 1000,
  });
}
