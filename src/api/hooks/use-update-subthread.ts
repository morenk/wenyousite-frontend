/** 更新子贴 API hook */

import { useMutation } from "@tanstack/react-query";
import { apiClient } from "@/api/client";
import type { SubthreadDetail } from "./use-thread-detail";

interface UpdateSubthreadBody {
  title?: string;
  sortOrder?: number;
  postingPolicy?: "PARTICIPANTS" | "COLLABORATORS" | "PLAYERS";
  version: number;
}

interface UpdateSubthreadResponse {
  code: number;
  message: string;
  data: SubthreadDetail;
}

export function useUpdateSubthread() {
  return useMutation({
    mutationFn: async ({
      subthreadId,
      body,
    }: {
      subthreadId: string;
      body: UpdateSubthreadBody;
    }) => {
      const { data, error } = await apiClient.PATCH("/api/v1/subthreads/{id}", {
        params: { path: { id: subthreadId } },
        body,
      });
      if (error) throw error;
      return (data as unknown as UpdateSubthreadResponse).data;
    },
  });
}
