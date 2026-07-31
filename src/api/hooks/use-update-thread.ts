/** 更新主题帖 / 发布 API hook */

import { useMutation } from "@tanstack/react-query";
import { apiClient } from "@/api/client";
import type { ThreadCreateFormData } from "@/lib/validations/thread-create";
import type { RawThreadDetail } from "./use-thread-detail";
import { normalizeThreadDetail } from "./use-thread-detail";

export interface UpdateThreadBody extends ThreadCreateFormData {
  published?: boolean;
  version: number;
}

interface UpdateThreadResponse {
  code: number;
  message: string;
  data: RawThreadDetail;
}

export function useUpdateThread() {
  return useMutation({
    mutationFn: async ({
      threadId,
      body,
    }: {
      threadId: string;
      body: UpdateThreadBody;
    }) => {
      const { data, error } = await apiClient.PATCH("/api/v1/threads/{id}", {
        params: { path: { id: threadId } },
        body: {
          title: body.title,
          category: body.category,
          visibility: body.visibility,
          subthreadTitle: body.subthreadTitle,
          published: body.published,
          version: body.version,
        },
      });
      if (error) throw error;
      return normalizeThreadDetail((data as unknown as UpdateThreadResponse).data);
    },
  });
}
