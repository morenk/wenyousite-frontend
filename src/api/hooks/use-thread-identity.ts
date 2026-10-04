/** 帖内身份请求与展示缓存统一失效；账号资料始终保持原字段语义。 */
import { useEffect, useLayoutEffect, useRef } from "react";
import { useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { shouldRetryContentQuery } from "@/api/errors";
import { apiClient } from "@/api/client";
import { queryKeys } from "@/api/query-keys";
import { useViewerScope } from "@/api/use-viewer-scope";
import type { components } from "@/api/types";

export type ThreadIdentityState = components["schemas"]["ThreadIdentityStateDto"];
export type UpdateThreadIdentity = components["schemas"]["UpdateThreadIdentityDto"];

export async function readThreadIdentity(threadId: string): Promise<ThreadIdentityState> {
  const { data, error } = await apiClient.GET("/api/v1/threads/{threadId}/identity", { params: { path: { threadId } } });
  if (error) throw error;
  if (!data) throw new Error("帖内身份响应为空");
  return data.data;
}

export function useThreadIdentity(threadId: string | undefined, enabled = true) {
  const viewer = useViewerScope();
  return useQuery({
    queryKey: queryKeys.threadIdentities.mine(threadId ?? "", viewer),
    queryFn: () => readThreadIdentity(threadId!),
    enabled: Boolean(threadId && enabled && viewer !== "anonymous"),
    staleTime: 10_000, retry: shouldRetryContentQuery,
  });
}

export function useThreadUserIdentity(threadId: string, userId: string, enabled: boolean) {
  const viewer = useViewerScope();
  const client = useQueryClient();
  const query = useQuery({
    queryKey: queryKeys.threadIdentities.user(threadId, userId, viewer),
    queryFn: async () => {
      const { data, error } = await apiClient.GET("/api/v1/threads/{threadId}/identities/{userId}", { params: { path: { threadId, userId } } });
      if (error) throw error;
      if (!data) throw new Error("帖内身份响应为空");
      return data.data;
    },
    enabled, staleTime: 0, retry: shouldRetryContentQuery,
  });
  useEffect(() => {
    if (!query.data) return;
    const key = queryKeys.threads.detailForViewer(threadId, viewer);
    const detail = client.getQueryData<components["schemas"]["ThreadDetailResponseDto"]>(key);
    if (detail && detail.rpIdentityEnabled !== undefined && detail.rpIdentityEnabled !== query.data.enabled) {
      client.setQueryData(key, { ...detail, rpIdentityEnabled: query.data.enabled });
      void invalidateThreadIdentityViews(client, threadId);
    }
  }, [client, query.data, threadId, viewer]);
  return query;
}

export function invalidateThreadIdentityViews(client: QueryClient, threadId: string) {
  return Promise.all([
    queryKeys.threadIdentities.thread(threadId), queryKeys.threads.detail(threadId),
    queryKeys.floors.all, queryKeys.replies.all, queryKeys.posts.all,
    queryKeys.members.list(threadId), queryKeys.mentionCandidatesRoot,
    queryKeys.search.all, queryKeys.notifications.all,
  ].map((queryKey) => client.invalidateQueries({ queryKey })));
}

export function useUpdateThreadIdentity(threadId: string) {
  const client = useQueryClient();
  const viewer = useViewerScope();
  const settled = (state: ThreadIdentityState) => {
    client.setQueryData(queryKeys.threadIdentities.mine(threadId, viewer), state);
    return invalidateThreadIdentityViews(client, threadId);
  };
  const save = useMutation({
    mutationFn: async (body: UpdateThreadIdentity) => {
      const { data, error } = await apiClient.PUT("/api/v1/threads/{threadId}/identity", { params: { path: { threadId } }, body });
      if (error) throw error;
      if (!data) throw new Error("身份保存响应为空");
      return data.data;
    },
    onSuccess: settled,
  });
  const clear = useMutation({
    mutationFn: async () => {
      const { data, error } = await apiClient.DELETE("/api/v1/threads/{threadId}/identity", { params: { path: { threadId } } });
      if (error) throw error;
      if (!data) throw new Error("身份清除响应为空");
      return data.data;
    },
    onSuccess: settled,
  });
  return { save, clear };
}

export function useSetThreadIdentityEnabled(threadId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (enabled: boolean) => {
      const { data, error } = await apiClient.PATCH("/api/v1/threads/{threadId}/identity-settings", {
        params: { path: { threadId } }, body: { enabled },
      });
      if (error) throw error;
      return data?.data;
    },
    onSuccess: () => invalidateThreadIdentityViews(client, threadId),
  });
}

/** 其他客户端更改开关后，丢弃旧展示投影，不能继续把旧缓存当作当前阅读结果。 */
export function useRefreshThreadIdentityProjection(threadId: string, enabled: boolean | undefined) {
  const client = useQueryClient();
  const previous = useRef<{ threadId: string; enabled: boolean } | null>(null);
  useLayoutEffect(() => {
    if (enabled === undefined) return;
    const prior = previous.current;
    previous.current = { threadId, enabled };
    if (!prior || prior.threadId !== threadId || prior.enabled === enabled) return;
    for (const queryKey of [
      queryKeys.floors.all, queryKeys.replies.all, queryKeys.posts.all,
      queryKeys.threadIdentities.thread(threadId), queryKeys.members.list(threadId),
      queryKeys.mentionCandidatesRoot, queryKeys.search.all, queryKeys.notifications.all,
    ]) void client.resetQueries({ queryKey });
  }, [client, enabled, threadId]);
}
