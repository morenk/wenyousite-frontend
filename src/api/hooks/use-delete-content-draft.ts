/** 删除正文草稿 API hook（DELETE /drafts/:id，硬删除） */

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/api/client";

interface DeleteDraftResponse {
  code: number;
  message: string;
  data: { message: string };
}

export function useDeleteContentDraft() {
  const queryClient = useQueryClient();

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["content-drafts"] });
    queryClient.invalidateQueries({ queryKey: ["draft-slots"] });
  };

  return useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await apiClient.DELETE("/api/v1/drafts/{id}", {
        params: { path: { id } },
      });
      if (error) throw error;
      return (data as unknown as DeleteDraftResponse).data;
    },
    onSuccess: invalidate,
  });
}
