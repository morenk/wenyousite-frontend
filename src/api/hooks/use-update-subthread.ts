/** 更新子贴 API hook */

import { useMutation } from "@tanstack/react-query";
import { apiClient } from "@/api/client";

interface UpdateSubthreadBody {
  title?: string;
  sortOrder?: number;
  postingPolicy?: "PARTICIPANTS" | "COLLABORATORS" | "PLAYERS";
  version: number;
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
      if (!data) throw new Error("更新子贴响应为空");
      return data.data;
    },
  });
}
