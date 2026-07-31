/** 编辑楼层 API hook（用于编辑默认子贴首楼正文） */

import { useMutation } from "@tanstack/react-query";
import { apiClient } from "@/api/client";
import type { CreatedPost } from "./use-create-post";

interface UpdatePostResponse {
  code: number;
  message: string;
  data: CreatedPost;
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
