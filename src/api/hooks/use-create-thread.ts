/** 创建主题帖草稿 API hook */

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { invalidateChangedMentionCandidates } from "./use-mention-candidates";
import { markdownWriteCapability } from "@/api/markdown-capability";
import { apiClient } from "@/api/client";
import type { ThreadCreateFormData } from "@/lib/validations/thread-create";
import type { ThreadDetail } from "./use-thread-detail";
import { normalizeThreadDetail } from "./use-thread-detail";

type CreateThreadInput = ThreadCreateFormData & { clientRequestId: string };

export function useCreateThread() {
  const queryClient = useQueryClient();
  return useMutation({
    onError: (error) => invalidateChangedMentionCandidates(queryClient, error),
    mutationFn: async (body: CreateThreadInput) => {
      const { data, error } = await apiClient.POST("/api/v1/threads", {
        body: {
          ...markdownWriteCapability(queryClient),
          title: body.title,
          category: body.category,
          visibility: body.visibility,
          subthreadTitle: body.subthreadTitle,
          content: body.content,
          tagNames: body.tagNames,
          clientRequestId: body.clientRequestId,
        },
      });
      if (error) throw error;
      if (!data) throw new Error("创建主题帖响应为空");
      return normalizeThreadDetail(data.data);
    },
  });
}

export type { ThreadDetail };
