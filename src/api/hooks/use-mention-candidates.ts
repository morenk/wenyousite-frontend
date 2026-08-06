/** 当前主题帖的 @提及候选人查询。 */

import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/api/client";
import { queryKeys } from "@/api/query-keys";

const EMPTY_MENTION_CANDIDATES = {
  users: [],
  canMentionAllPlayers: false,
} as const;

export function useMentionCandidates(
  threadId: string | undefined,
  query: string,
  enabled: boolean,
) {
  return useQuery({
    queryKey: queryKeys.mentionCandidates(threadId ?? "", query),
    queryFn: async () => {
      if (!threadId) throw new Error("缺少主题帖 ID");
      const { data, error } = await apiClient.GET(
        "/api/v1/users/mention-candidates",
        {
          params: {
            query: {
              threadId,
              ...(query ? { q: query } : {}),
            },
          },
        },
      );
      if (error) throw error;
      return data?.data ?? EMPTY_MENTION_CANDIDATES;
    },
    enabled: Boolean(threadId && enabled),
    staleTime: 10_000,
  });
}
