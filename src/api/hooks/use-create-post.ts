/** 创建楼层 API hook（发布楼层或楼中楼回复） */

import { useMutation } from "@tanstack/react-query";
import { apiClient } from "@/api/client";
import type { components } from "@/api/types";

export type CreatedPost = components["schemas"]["PostResponseDto"];

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
      if (!data) throw new Error("创建帖子响应为空");
      return data.data;
    },
  });
}
