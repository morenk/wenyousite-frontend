/** 保存正文草稿 API hook（POST /drafts：指定 slot 覆盖更新，不指定自动分配空闲位） */

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/api/client";
import type { DraftItem } from "./use-content-drafts";

interface SaveDraftResponse {
  code: number;
  message: string;
  data: DraftItem;
}

export interface SaveDraftArgs {
  content: string;
  slot?: number;
}

export function useSaveDraft() {
  const queryClient = useQueryClient();

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["content-drafts"] });
    queryClient.invalidateQueries({ queryKey: ["draft-slots"] });
  };

  return useMutation({
    mutationFn: async ({ content, slot }: SaveDraftArgs) => {
      const { data, error } = await apiClient.POST("/api/v1/drafts", {
        body: { content, ...(slot !== undefined ? { slot } : {}) },
      });
      if (error) throw error;
      return (data as unknown as SaveDraftResponse).data;
    },
    onSuccess: invalidate,
  });
}
