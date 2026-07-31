/** 删除子贴 API hook */

import { useMutation } from "@tanstack/react-query";
import { apiClient } from "@/api/client";

export function useDeleteSubthread() {
  return useMutation({
    mutationFn: async (subthreadId: string) => {
      const { error } = await apiClient.DELETE("/api/v1/subthreads/{id}", {
        params: { path: { id: subthreadId } },
      });
      if (error) throw error;
    },
  });
}
