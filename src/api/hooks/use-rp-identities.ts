/** 多角色只通过稳定身份 ID 读写；兼容主身份仍由旧接口服务目录与提及。 */
import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { shouldRetryContentQuery } from "@/api/errors";
import { apiClient } from "@/api/client";
import { queryKeys } from "@/api/query-keys";
import { useViewerScope } from "@/api/use-viewer-scope";
import type { components } from "@/api/types";
import { invalidateThreadIdentityViews } from "./use-thread-identity";

export type RpIdentityState = components["schemas"]["RpIdentityStateDto"];
export type RpIdentityCollection = components["schemas"]["RpIdentityCollectionDto"];
export type CreateRpIdentity = components["schemas"]["CreateRpIdentityDto"];
export type UpdateRpIdentity = components["schemas"]["UpdateRpIdentityDto"];

export async function readRpIdentities(threadId: string): Promise<RpIdentityCollection> {
  const { data, error } = await apiClient.GET("/api/v1/threads/{threadId}/rp-identities", { params: { path: { threadId } } });
  if (error) throw error;
  if (!data) throw new Error("身份列表响应为空");
  return data.data;
}

export async function readRpIdentity(threadId: string, identityId: string): Promise<RpIdentityState> {
  const { data, error } = await apiClient.GET("/api/v1/threads/{threadId}/rp-identities/{identityId}", { params: { path: { threadId, identityId } } });
  if (error) throw error;
  if (!data) throw new Error("角色身份响应为空");
  return data.data;
}

function observeEnabled(client: QueryClient, threadId: string, viewer: string, enabled: boolean | undefined) {
  if (enabled === undefined) return;
  const key = queryKeys.threads.detailForViewer(threadId, viewer);
  const detail = client.getQueryData<components["schemas"]["ThreadDetailResponseDto"]>(key);
  if (detail && detail.rpIdentityEnabled !== undefined && detail.rpIdentityEnabled !== enabled) {
    client.setQueryData(key, { ...detail, rpIdentityEnabled: enabled });
    void invalidateThreadIdentityViews(client, threadId);
  }
}

export function useRpIdentities(threadId: string | undefined, enabled = true) {
  const viewer = useViewerScope();
  const client = useQueryClient();
  const query = useQuery({
    queryKey: queryKeys.threadIdentities.collection(threadId ?? "", viewer),
    queryFn: () => readRpIdentities(threadId!),
    enabled: Boolean(threadId && enabled && viewer !== "anonymous"),
    staleTime: 10_000, retry: shouldRetryContentQuery,
  });
  useEffect(() => { if (threadId) observeEnabled(client, threadId, viewer, query.data?.enabled); }, [client, threadId, viewer, query.data?.enabled]);
  return query;
}

export function useRpIdentity(threadId: string, identityId: string | undefined, enabled = true) {
  const viewer = useViewerScope();
  const client = useQueryClient();
  const query = useQuery({
    queryKey: queryKeys.threadIdentities.role(threadId, identityId ?? "", viewer),
    queryFn: () => readRpIdentity(threadId, identityId!),
    enabled: Boolean(identityId && enabled), staleTime: 0, retry: shouldRetryContentQuery,
  });
  useEffect(() => { observeEnabled(client, threadId, viewer, query.data?.enabled); }, [client, threadId, viewer, query.data?.enabled]);
  return query;
}

export function useMutateRpIdentity(threadId: string) {
  const client = useQueryClient();
  const viewer = useViewerScope();
  const settled = (state: RpIdentityState) => {
    client.setQueryData(queryKeys.threadIdentities.role(threadId, state.identityId, viewer), state);
    client.setQueryData<RpIdentityCollection>(queryKeys.threadIdentities.collection(threadId, viewer), (current) => {
      if (!current) return current;
      const found = current.identities.some((item) => item.identityId === state.identityId);
      const identities = state.deleted
        ? current.identities.filter((item) => item.identityId !== state.identityId)
        : found ? current.identities.map((item) => item.identityId === state.identityId ? state : item)
          : [...current.identities, state];
      return { ...current, identities, activeCount: identities.length };
    });
    // 已确认的写入先交给调用者；集合刷新失败不能把成功 POST 伪装为创建失败。
    void invalidateThreadIdentityViews(client, threadId).catch(() => undefined);
  };
  const create = useMutation({
    mutationFn: async (body: CreateRpIdentity) => {
      const { data, error } = await apiClient.POST("/api/v1/threads/{threadId}/rp-identities", { params: { path: { threadId } }, body });
      if (error) throw error;
      if (!data) throw new Error("新建身份响应为空");
      return data.data;
    }, onSuccess: settled,
  });
  const update = useMutation({
    mutationFn: async ({ identityId, body }: { identityId: string; body: UpdateRpIdentity }) => {
      const { data, error } = await apiClient.PUT("/api/v1/threads/{threadId}/rp-identities/{identityId}", { params: { path: { threadId, identityId } }, body });
      if (error) throw error;
      if (!data) throw new Error("保存身份响应为空");
      return data.data;
    }, onSuccess: settled,
  });
  const remove = useMutation({
    mutationFn: async ({ identityId, version }: { identityId: string; version: number }) => {
      const { data, error } = await apiClient.DELETE("/api/v1/threads/{threadId}/rp-identities/{identityId}", { params: { path: { threadId, identityId } }, body: { version } });
      if (error) throw error;
      if (!data) throw new Error("删除身份响应为空");
      return data.data;
    }, onSuccess: settled,
  });
  return { create, update, remove };
}

export function canPublishAsIdentity(role: RpIdentityState | undefined) {
  return Boolean(role && role.enabled && role.eligible && !role.deleted && role.display && role.identityToken);
}
