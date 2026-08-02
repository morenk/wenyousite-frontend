/** 正文草稿槽位使用情况 API hook（GET /drafts/slots） */

import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/api/client";

export interface DraftSlotsInfo {
  usedSlots: number;
  maxSlots: number;
  slots: number[];
}

interface DraftSlotsResponse {
  code: number;
  message: string;
  data: DraftSlotsInfo;
}

export function useDraftSlots(enabled = true) {
  return useQuery({
    queryKey: ["draft-slots"],
    queryFn: async () => {
      const { data, error } = await apiClient.GET("/api/v1/drafts/slots");
      if (error) throw error;
      const response = data as unknown as DraftSlotsResponse;
      return (
        response?.data ?? { usedSlots: 0, maxSlots: 5, slots: [] }
      );
    },
    enabled,
    staleTime: 10 * 1000,
  });
}
