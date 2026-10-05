/** 当前主题帖的 @提及候选人查询。 */

import { useQuery, type QueryClient } from "@tanstack/react-query";
import { API_ERROR_CODE, getApiError } from "@/api/errors";
import { apiClient } from "@/api/client";
import { useApiMeta } from "./use-api-meta";
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
  const metaQuery = useApiMeta(Boolean(threadId && enabled));
  const meta = metaQuery.data;
  const includeIdentities = meta?.capabilities?.roleMentionsV6Supported === true;
  const result = useQuery({
    queryKey: queryKeys.mentionCandidates(threadId ?? "", query, includeIdentities),
    queryFn: async () => {
      if (!threadId) throw new Error("缺少主题帖 ID");
      const { data, error } = await apiClient.GET(
        "/api/v1/users/mention-candidates",
        {
          params: {
            query: {
              threadId,
              ...(includeIdentities ? { includeIdentities: true } : {}),
              ...(query ? { q: query } : {}),
            },
          },
        },
      );
      if (error) throw error;
      return data?.data ?? EMPTY_MENTION_CANDIDATES;
    },
    enabled: Boolean(threadId && enabled && meta),
    staleTime: 10_000,
  });
  const userMentionsUnavailable = includeIdentities && meta?.capabilities?.roleMentionsV6WriteEnabled !== true;
  return { ...result,
    // 已观测到关闭时也遮蔽仍在缓存中的旧候选；全体玩家权限独立保留。
    data: userMentionsUnavailable && result.data ? { ...result.data, users: [] } : result.data,
    refetch: !meta || metaQuery.isError ? metaQuery.refetch : result.refetch, isFetching: result.isFetching || metaQuery.isFetching, isError: result.isError || metaQuery.isError,
    userMentionsUnavailable };
}

/** 明确拒绝过期提及时立即刷新候选，重选不能继续命中过期名字。 */
export function invalidateChangedMentionCandidates(client: QueryClient, error: unknown) {
  const code = getApiError(error).code;
  if (code === API_ERROR_CODE.ROLE_MENTIONS_DISABLED || code === API_ERROR_CODE.MARKDOWN_CAPABILITY_REQUIRED) {
    return Promise.all([
      client.invalidateQueries({ queryKey: queryKeys.meta }),
      client.invalidateQueries({ queryKey: queryKeys.mentionCandidatesRoot }),
    ]);
  }
  if (code === API_ERROR_CODE.RP_MENTION_CHANGED) {
    return client.invalidateQueries({ queryKey: queryKeys.mentionCandidatesRoot });
  }
}
