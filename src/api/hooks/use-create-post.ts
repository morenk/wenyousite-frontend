/** 创建楼层 API hook（发布楼层或楼中楼回复） */

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { invalidateChangedMentionCandidates } from "./use-mention-candidates";
import { markdownWriteCapability } from "@/api/markdown-capability";
import { apiClient } from "@/api/client";
import { queryKeys } from "@/api/query-keys";
import type { components } from "@/api/types";
import { watchPostWriteSession } from "@/api/post-write-cache";

export type CreatedPost = components["schemas"]["PostResponseDto"];

export type CreatePostArgs = components["schemas"]["CreatePostDto"] & { subthreadId: string };

export function useCreatePost() {
  const queryClient = useQueryClient();
  return useMutation({
    onMutate: watchPostWriteSession,
    mutationFn: async ({ subthreadId, ...body }: CreatePostArgs) => {
      const { data, error } = await apiClient.POST(
        "/api/v1/subthreads/{subthreadId}/posts",
        {
          params: { path: { subthreadId } },
          body: { ...markdownWriteCapability(queryClient), ...body },
        },
      );
      if (error) throw error;
      if (!data) throw new Error("创建帖子响应为空");
      return data.data;
    },
    onError: (error) => invalidateChangedMentionCandidates(queryClient, error),
    onSuccess: (_data, variables, session) => {
      if (!session?.isCurrent()) return;
      // 保持服务端窗口成员、分页和统计为准；后台刷新不延长已确认发表的 pending。
      void Promise.all([
        queryClient.invalidateQueries({
          queryKey: queryKeys.floors.list(variables.subthreadId),
        }),
        queryClient.invalidateQueries({ queryKey: queryKeys.users.all,
          predicate: (query) => query.queryKey.includes(session.viewer) }),
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
      ]);
    },
    onSettled: (_data, _error, _variables, session) => session?.dispose(),
  });
}
