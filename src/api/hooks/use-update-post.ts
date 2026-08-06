/** 编辑楼层 API hook（乐观锁 version 更新正文） */

import { useMutation } from "@tanstack/react-query";
import { apiClient } from "@/api/client";

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
      if (!data) throw new Error("更新帖子响应为空");
      return data.data;
    },
  });
}
