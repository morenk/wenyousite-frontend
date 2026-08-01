/** 编辑楼层 API hook（乐观锁 version 更新正文） */

import { useMutation } from "@tanstack/react-query";
import { apiClient } from "@/api/client";
import type { PostData } from "./use-floors";

interface UpdatePostResponse {
  code: number;
  message: string;
  data: PostData;
}

export function useUpdatePost() {
  return useMutation({
    mutationFn: async ({
      postId,
      content,
      version,
    }: {
      postId: string;
      content: string;
      version: number;
    }) => {
      const { data, error } = await apiClient.PATCH("/api/v1/posts/{id}", {
        params: { path: { id: postId } },
        body: { content, version },
      });
      if (error) throw error;
      return (data as unknown as UpdatePostResponse).data;
    },
  });
}
