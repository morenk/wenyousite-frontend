/** 创建主题帖草稿 API hook */

import { useMutation } from "@tanstack/react-query";
import { apiClient } from "@/api/client";
import type { ThreadCreateFormData } from "@/lib/validations/thread-create";
import type { ThreadDetail, RawThreadDetail } from "./use-thread-detail";
import { normalizeThreadDetail } from "./use-thread-detail";

interface CreateThreadResponse {
  code: number;
  message: string;
  data: RawThreadDetail;
}

export function useCreateThread() {
  return useMutation({
    mutationFn: async (body: ThreadCreateFormData) => {
      const { data, error } = await apiClient.POST("/api/v1/threads", {
        body: {
          title: body.title,
          category: body.category,
          visibility: body.visibility,
          subthreadTitle: body.subthreadTitle,
          content: body.content,
          tagNames: body.tagNames,
        },
      });
      if (error) throw error;
      return normalizeThreadDetail((data as unknown as CreateThreadResponse).data);
    },
  });
}

export type { ThreadDetail };
