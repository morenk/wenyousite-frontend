/** 创建子贴 API hook */

import { useMutation } from "@tanstack/react-query";
import { apiClient } from "@/api/client";
import type { components } from "@/api/types";

interface CreateSubthreadBody {
  title: string;
  content?: string;
  sortOrder?: number;
  postingPolicy: "PARTICIPANTS" | "COLLABORATORS" | "PLAYERS";
}

export type CreatedSubthread = components["schemas"]["SubthreadResponseDto"];

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
      if (!data) throw new Error("创建子贴响应为空");
      return data.data;
    },
  });
}
