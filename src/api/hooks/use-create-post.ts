/** 创建楼层 API hook（发布楼层或楼中楼回复） */

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

interface CreatePostArgs {
  subthreadId: string;
  content: string;
  parentPostId?: string;
  replyToPostId?: string;
}

export function useCreatePost() {
  return useMutation({
    mutationFn: async ({ subthreadId, content, parentPostId, replyToPostId }: CreatePostArgs) => {
      const { data, error } = await apiClient.POST(
        "/api/v1/subthreads/{subthreadId}/posts",
        {
          params: { path: { subthreadId } },
          body: { content, parentPostId, replyToPostId },
        },
      );
      if (error) throw error;
      return (data as unknown as CreatePostResponse).data;
    },
  });
}
