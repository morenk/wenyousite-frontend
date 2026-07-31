/** 子贴排序 API hook */

import { useMutation } from "@tanstack/react-query";
import { apiClient } from "@/api/client";

export function useReorderSubthreads() {
  return useMutation({
    mutationFn: async ({
      threadId,
      ids,
    }: {
      threadId: string;
      ids: string[];
    }) => {
      const { error } = await apiClient.PUT(
        "/api/v1/threads/{threadId}/subthreads/reorder",
        {
          params: { path: { threadId } },
          body: { ids },
        },
      );
      if (error) throw error;
    },
  });
}
