/** 保存正文草稿 API hook（POST 只创建；已有草稿始终按稳定 ID PATCH） */

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/api/client";
import { queryKeys } from "@/api/query-keys";
import {
  draftStateFromDrafts,
  type DraftState,
} from "@/api/hooks/use-content-drafts";

export interface CreateDraftArgs {
  content: string;
  slot?: number;
  clientRequestId?: string;
  draftId?: never;
  version?: never;
}

export interface UpdateDraftArgs {
  draftId: string;
  content: string;
  version: number;
  slot?: never;
  clientRequestId?: never;
}

export type SaveDraftArgs = CreateDraftArgs | UpdateDraftArgs;

export function useSaveDraft() {
  const queryClient = useQueryClient();

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: queryKeys.draftState });

  return useMutation({
    mutationFn: async (args: SaveDraftArgs) => {
      if ("draftId" in args && args.draftId) {
        const { data, error } = await apiClient.PATCH("/api/v1/drafts/{id}", {
          params: { path: { id: args.draftId } },
          body: { content: args.content, version: args.version },
        });
        if (error) throw error;
        if (!data) throw new Error("保存草稿响应为空");
        return data.data;
      }

      const { data, error } = await apiClient.POST("/api/v1/drafts", {
        body: {
          content: args.content,
          clientRequestId: args.clientRequestId ?? crypto.randomUUID(),
          ...(args.slot !== undefined ? { slot: args.slot } : {}),
        },
      });
      if (error) throw error;
      if (!data) throw new Error("保存草稿响应为空");
      return data.data;
    },
    onSuccess: (draft) => {
      queryClient.setQueryData<DraftState>(queryKeys.draftState, (current) => {
        if (!current) return current;
        const exists = current.drafts.some((item) => item.id === draft.id);
        const drafts = exists
          ? current.drafts.map((item) => (item.id === draft.id ? draft : item))
          : [...current.drafts, draft];
        return draftStateFromDrafts(drafts, current.maxSlots);
      });
      void invalidate();
    },
    onError: () => void invalidate(),
  });
}
