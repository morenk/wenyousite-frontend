/** 删除主题帖草稿 API hook */

import { useMutation } from "@tanstack/react-query";
import { apiClient } from "@/api/client";

interface DeleteThreadResponse {
  code: number;
  message: string;
  data: unknown;
}

export function useDeleteThread() {
  return useMutation({
    mutationFn: async (threadId: string) => {
      const { data, error } = await apiClient.DELETE("/api/v1/threads/{id}", {
        params: { path: { id: threadId } },
      });
      if (error) throw error;
      return (data as unknown as DeleteThreadResponse).data;
    },
  });
}
