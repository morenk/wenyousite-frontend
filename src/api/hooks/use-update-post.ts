/** 编辑楼层 API hook（乐观锁 version 更新正文） */

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { invalidateChangedMentionCandidates } from "./use-mention-candidates";
import { markdownWriteCapability } from "@/api/markdown-capability";
import { apiClient } from "@/api/client";
import { applySavedPost, watchPostWriteSession } from "@/api/post-write-cache";

export function useUpdatePost() {
  const queryClient = useQueryClient();
  return useMutation({
    onMutate: watchPostWriteSession,
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
        body: { ...markdownWriteCapability(queryClient), content, version },
      });
      if (error) throw error;
      if (!data) throw new Error("更新帖子响应为空");
      return data.data;
    },
    onError: (error) => invalidateChangedMentionCandidates(queryClient, error),
    onSuccess: (data, _variables, session) => session && applySavedPost(queryClient, data, session),
    onSettled: (_data, _error, _variables, session) => session?.dispose(),
  });
}
