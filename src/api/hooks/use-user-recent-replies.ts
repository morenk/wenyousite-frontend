/** 用户最近动态 API hook（GET /users/:id/recent-replies，固定 10 条不分页） */

import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/api/client";
import { queryKeys } from "@/api/query-keys";
import type { components } from "@/api/types";

type GeneratedRecentReply = components["schemas"]["RecentReplyResponseDto"];
export type RecentReply = Omit<GeneratedRecentReply, "diceRolls"> & {
  diceRolls?: GeneratedRecentReply["diceRolls"];
};

export function useUserRecentReplies(userId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.users.recentReplies(userId),
    queryFn: async () => {
      if (!userId) throw new Error("缺少用户 ID");
      const { data, error } = await apiClient.GET(
        "/api/v1/users/{id}/recent-replies",
        { params: { path: { id: userId } } },
      );
      if (error) throw error;
      return data?.data ?? [];
    },
    enabled: !!userId,
    staleTime: 60 * 1000,
  });
}
