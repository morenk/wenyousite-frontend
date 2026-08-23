/** 正文草稿槽位使用情况 hook（复用 GET /drafts/state 的原子快照） */

import { useQuery } from "@tanstack/react-query";
import type { components } from "@/api/types";
import { draftStateQueryOptions } from "@/api/hooks/use-content-drafts";

export type DraftSlotsInfo = components["schemas"]["DraftSlotUsageResponseDto"];

export function useDraftSlots(enabled = true) {
  return useQuery({
    ...draftStateQueryOptions,
    select: ({ usedSlots, maxSlots, slots }) => ({ usedSlots, maxSlots, slots }),
    enabled,
  });
}
