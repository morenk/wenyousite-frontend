/** 删除正文草稿 API hook（DELETE /drafts/:id，硬删除） */

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/api/client";
import { queryKeys } from "@/api/query-keys";

export function useDeleteContentDraft() {
  const queryClient = useQueryClient();

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.contentDrafts });
    queryClient.invalidateQueries({ queryKey: queryKeys.draftSlots });
  };

  return useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await apiClient.DELETE("/api/v1/drafts/{id}", {
        params: { path: { id } },
      });
      if (error) throw error;
      if (!data) throw new Error("删除草稿响应为空");
      return data.data;
    },
    onSuccess: invalidate,
  });
}
