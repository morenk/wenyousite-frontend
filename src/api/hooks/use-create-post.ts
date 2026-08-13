/** 创建楼层 API hook（发布楼层或楼中楼回复） */

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/api/client";
import { queryKeys } from "@/api/query-keys";
import type { components } from "@/api/types";

export type CreatedPost = components["schemas"]["PostResponseDto"];

interface CreatePostArgs {
  subthreadId: string;
  content: string;
  clientRequestId: string;
  parentPostId?: string;
  replyToPostId?: string;
}

export function useCreatePost() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ subthreadId, content, clientRequestId, parentPostId, replyToPostId }: CreatePostArgs) => {
      const { data, error } = await apiClient.POST(
        "/api/v1/subthreads/{subthreadId}/posts",
        {
          params: { path: { subthreadId } },
          body: { content, parentPostId, replyToPostId, clientRequestId },
        },
      );
      if (error) throw error;
      if (!data) throw new Error("创建帖子响应为空");
      return data.data;
    },
    onSuccess: (_data, variables) =>
      Promise.all([
        queryClient.invalidateQueries({
          queryKey: queryKeys.floors.list(variables.subthreadId),
        }),
        queryClient.invalidateQueries({ queryKey: queryKeys.users.all }),
        ...(variables.parentPostId
          ? [
              queryClient.invalidateQueries({
                queryKey: queryKeys.replies.list(variables.parentPostId),
              }),
              queryClient.invalidateQueries({
                queryKey: queryKeys.posts.detail(variables.parentPostId),
              }),
            ]
          : []),
      ]),
  });
}
