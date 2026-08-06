/** 保存正文草稿 API hook（POST /drafts：指定 slot 覆盖更新，不指定自动分配空闲位） */

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/api/client";
import { queryKeys } from "@/api/query-keys";
import type { DraftItem } from "@/api/hooks/use-content-drafts";

export interface SaveDraftArgs {
  content: string;
  slot?: number;
  version?: number;
}

export function useSaveDraft() {
  const queryClient = useQueryClient();

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.contentDrafts });
    queryClient.invalidateQueries({ queryKey: queryKeys.draftSlots });
  };

  return useMutation({
    mutationFn: async ({ content, slot, version }: SaveDraftArgs) => {
      const { data, error } = await apiClient.POST("/api/v1/drafts", {
        body: {
          content,
          ...(slot !== undefined ? { slot } : {}),
          ...(version !== undefined ? { version } : {}),
        },
      });
      if (error) throw error;
      if (!data) throw new Error("保存草稿响应为空");
      return data.data;
    },
    onSuccess: (draft) => {
      queryClient.setQueryData<DraftItem[]>(queryKeys.contentDrafts, (current) => {
        if (!current) return [draft];
        const exists = current.some((item) => item.id === draft.id);
        return exists
          ? current.map((item) => (item.id === draft.id ? draft : item))
          : [...current, draft].sort((a, b) => a.slot - b.slot);
      });
      invalidate();
    },
    onError: invalidate,
  });
}
