/** 删除主题帖 API hook：草稿硬删除，已发布帖软删除 */

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/api/client";
import { queryKeys } from "@/api/query-keys";

export function useDeleteThread() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (threadId: string) => {
      const { data, error } = await apiClient.DELETE("/api/v1/threads/{id}", {
        params: { path: { id: threadId } },
      });
      if (error) throw error;
      if (!data) throw new Error("删除主题帖响应为空");
      return data.data;
    },
    onSuccess: (_data, threadId) => {
      queryClient.removeQueries({ queryKey: queryKeys.threads.detail(threadId) });
      return Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.threads.all }),
        queryClient.invalidateQueries({ queryKey: queryKeys.threadDrafts }),
      ]);
    },
  });
}
