/** 创建子贴 API hook */

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { invalidateChangedMentionCandidates } from "./use-mention-candidates";
import { markdownWriteCapability } from "@/api/markdown-capability";
import { apiClient } from "@/api/client";
import type { components } from "@/api/types";

type CreateSubthreadBody = components["schemas"]["CreateSubthreadDto"];

export type CreatedSubthread = components["schemas"]["SubthreadResponseDto"];

export function useCreateSubthread() {
  const queryClient = useQueryClient();
  return useMutation({
    onError: (error) => invalidateChangedMentionCandidates(queryClient, error),
    mutationFn: async ({
      threadId,
      body,
    }: {
      threadId: string;
      body: CreateSubthreadBody;
    }) => {
      const { data, error } = await apiClient.POST(
        "/api/v1/threads/{threadId}/subthreads",
        {
          params: { path: { threadId } },
          body: { ...markdownWriteCapability(queryClient), ...body },
        },
      );
      if (error) throw error;
      if (!data) throw new Error("创建子贴响应为空");
      return data.data;
    },
  });
}
