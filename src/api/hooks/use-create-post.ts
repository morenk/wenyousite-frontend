/** 创建楼层 API hook（用于创建默认子贴首楼） */

import { useMutation } from "@tanstack/react-query";
import { apiClient } from "@/api/client";

export interface CreatedPost {
  id: string;
  content: string;
  floorNumber: number | null;
  version: number;
  subthreadId: string;
  threadId: string;
  authorId: string;
}

interface CreatePostResponse {
  code: number;
  message: string;
  data: CreatedPost;
}

export function useCreatePost() {
  return useMutation({
    mutationFn: async ({
      subthreadId,
      content,
    }: {
      subthreadId: string;
      content: string;
    }) => {
      const { data, error } = await apiClient.POST(
        "/api/v1/subthreads/{subthreadId}/posts",
        {
          params: { path: { subthreadId } },
          body: { content },
        },
      );
      if (error) throw error;
      return (data as unknown as CreatePostResponse).data;
    },
  });
}
