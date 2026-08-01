/** 阅读进度 API hooks：记录进度 + 新回复数 */

import { useMutation } from "@tanstack/react-query";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/api/client";

/** 记录阅读进度（精确到楼层/楼中楼） */
export function useUpdateReadingProgress() {
  return useMutation({
    mutationFn: async ({
      subthreadId,
      postId,
    }: {
      subthreadId: string;
      postId?: string;
    }) => {
      const { data, error } = await apiClient.POST("/api/v1/reading-progress", {
        body: { subthreadId, postId },
      });
      if (error) throw error;
      return data;
    },
  });
}

export interface NewRepliesInfo {
  newReplies: number;
  totalPosts: number;
  lastReadPostId: string | null;
  lastReadTime: string | null;
  continueFrom: {
    id: string;
    floorNumber: number | null;
    parentPostId: string | null;
  } | null;
}

interface NewRepliesResponse {
  code: number;
  message: string;
  data: NewRepliesInfo;
}

/** 自上次阅读后子贴新增回复数 */
export function useNewReplies(subthreadId: string | undefined, enabled = true) {
  return useQuery({
    queryKey: ["new-replies", subthreadId],
    queryFn: async () => {
      if (!subthreadId) throw new Error("缺少子贴 ID");
      const { data, error } = await apiClient.GET("/api/v1/reading-progress/new-replies", {
        params: { query: { subthreadId } },
      });
      if (error) throw error;
      return (data as unknown as NewRepliesResponse).data;
    },
    enabled: !!subthreadId && enabled,
    staleTime: 10 * 1000,
  });
}
