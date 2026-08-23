/** 正文草稿 API hook（GET /drafts/state，全局 5 槽位草稿池） */

import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/api/client";
import { queryKeys } from "@/api/query-keys";
import type { components } from "@/api/types";

/** 正文草稿实体（Draft 模型，userId + slot 联合唯一） */
export type DraftItem = components["schemas"]["DraftResponseDto"];
export type DraftState = components["schemas"]["DraftStateResponseDto"];

const EMPTY_DRAFT_STATE: DraftState = {
  drafts: [],
  usedSlots: 0,
  maxSlots: 5,
  slots: [],
};

/** 始终从同一份有序列表推导槽位摘要，避免缓存内出现两套事实。 */
export function draftStateFromDrafts(
  drafts: DraftItem[],
  maxSlots = 5,
): DraftState {
  const orderedDrafts = [...drafts].sort((left, right) => left.slot - right.slot);
  return {
    drafts: orderedDrafts,
    usedSlots: orderedDrafts.length,
    maxSlots,
    slots: orderedDrafts.map((draft) => draft.slot),
  };
}

export const draftStateQueryOptions = {
  queryKey: queryKeys.draftState,
  queryFn: async (): Promise<DraftState> => {
    const { data, error } = await apiClient.GET("/api/v1/drafts/state");
    if (error) throw error;
    return data?.data ?? EMPTY_DRAFT_STATE;
  },
  staleTime: 10 * 1000,
} as const;

export function useContentDrafts() {
  return useQuery({
    ...draftStateQueryOptions,
    select: (state) => state.drafts,
  });
}
