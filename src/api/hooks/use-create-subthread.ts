/** 创建子贴 API hook */

import { useMutation } from "@tanstack/react-query";
import { apiClient } from "@/api/client";
import type { SubthreadDetail } from "./use-thread-detail";

interface CreateSubthreadBody {
  title: string;
  content?: string;
  sortOrder?: number;
  postingPolicy: "PARTICIPANTS" | "COLLABORATORS" | "PLAYERS";
}

interface CreateSubthreadResponse {
  code: number;
  message: string;
  data: SubthreadDetail;
}

export function useCreateSubthread() {
  return useMutation({
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
          body,
        },
      );
      if (error) throw error;
      return (data as unknown as CreateSubthreadResponse).data;
    },
  });
}
