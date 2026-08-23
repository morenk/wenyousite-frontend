/** 删除正文草稿 API hook（DELETE /drafts/:id，硬删除） */

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/api/client";
import { queryKeys } from "@/api/query-keys";
import {
  draftStateFromDrafts,
  type DraftState,
} from "@/api/hooks/use-content-drafts";

export interface DeleteContentDraftArgs {
  id: string;
  version: number;
}

export function useDeleteContentDraft() {
  const queryClient = useQueryClient();

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: queryKeys.draftState });

  return useMutation({
    mutationFn: async ({ id, version }: DeleteContentDraftArgs) => {
      const { data, error } = await apiClient.DELETE("/api/v1/drafts/{id}", {
        params: { path: { id }, query: { version } },
      });
      if (error) throw error;
      if (!data) throw new Error("删除草稿响应为空");
      return data.data;
    },
    onSuccess: (_result, { id }) => {
      queryClient.setQueryData<DraftState>(queryKeys.draftState, (current) =>
        current
          ? draftStateFromDrafts(
              current.drafts.filter((draft) => draft.id !== id),
              current.maxSlots,
            )
          : current,
      );
      void invalidate();
    },
  });
}
