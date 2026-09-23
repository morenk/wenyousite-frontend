/** 三种关系写入共用缓存、身份保护与结果不明的只读核对。 */

import { useSyncExternalStore } from "react";
import { useMutation, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { apiClient } from "@/api/client";
import { resetBlockRelatedQueries } from "@/api/content-access-cache";
import { getApiErrorMessage } from "@/api/errors";
import { queryKeys } from "@/api/query-keys";
import { useViewerScope } from "@/api/use-viewer-scope";
import { getAuthSnapshot, subscribeAuthStore } from "@/lib/auth-store";
import { followListOptions, type FollowUser } from "./use-user-follow-list";

const pairStates = new WeakMap<QueryClient, { pending: Set<string>; uncertain: Map<string, RelationAction> }>();
function states(client: QueryClient) {
  let value = pairStates.get(client);
  if (!value) { value = { pending: new Set(), uncertain: new Map() }; pairStates.set(client, value); }
  return value;
}
const listeners = new Set<() => void>();
function subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; }
function notify() { for (const listener of listeners) listener(); }
function setUncertain(client: QueryClient, pair: string, action?: RelationAction) {
  if (action) states(client).uncertain.set(pair, action); else states(client).uncertain.delete(pair);
  for (const listener of listeners) listener();
}
type RelationAction = "follow" | "unfollow" | "removeFollower" | "block" | "unblock";
const isBlockAction = (action: RelationAction | undefined) => action === "block" || action === "unblock";

async function readBlocked(client: QueryClient, viewer: string, target: string) {
  return client.fetchQuery({
    queryKey: queryKeys.users.blockStateForViewer(target, viewer), staleTime: 0, retry: false,
    queryFn: async ({ signal }) => {
      const { data, error } = await apiClient.GET("/api/v1/users/{id}", {
        params: { path: { id: target } }, signal: AbortSignal.any([signal, AbortSignal.timeout(15000)]),
      });
      if (error) throw error;
      if (typeof data?.data?.isBlocked !== "boolean") throw new Error("无法核实拉黑状态");
      return data.data.isBlocked;
    },
  });
}

async function invalidateRelationships(client: QueryClient) {
  await Promise.all([
    client.invalidateQueries({ queryKey: queryKeys.users.all }),
    client.invalidateQueries({ queryKey: queryKeys.me }),
  ]);
}

export async function changeRelationship(client: QueryClient, viewer: string, target: string, action: RelationAction | "reconcile") {
  const pair = JSON.stringify([viewer, target]);
  const { pending: pendingPairs, uncertain: uncertainPairs } = states(client);
  if (pendingPairs.has(pair)) throw new Error("该用户的关系正在更新");
  if (action !== "reconcile" && uncertainPairs.has(pair)) throw new Error("请先刷新核实关系");
  pendingPairs.add(pair);
  notify();
  let currentSession = getAuthSnapshot().user?.id === viewer;
  const unsubscribe = subscribeAuthStore(() => {
    if (getAuthSnapshot().user?.id !== viewer) {
      currentSession = false;
      void client.cancelQueries({ queryKey: queryKeys.users.all });
      void client.cancelQueries({ queryKey: queryKeys.me });
    }
  });
  const assertSession = () => {
    if (!currentSession) throw new Error("登录状态已变化，请刷新后重试");
  };
  try {
    assertSession();
    await Promise.all([
      client.cancelQueries({ queryKey: queryKeys.users.all }),
      client.cancelQueries({ queryKey: queryKeys.me }),
    ]);
    assertSession();
    if (action === "reconcile") {
      try {
        if (isBlockAction(uncertainPairs.get(pair))) {
          await readBlocked(client, viewer, target);
          assertSession();
          await resetBlockRelatedQueries(client);
        } else {
          await Promise.all((["following", "followers"] as const).map((kind) =>
            client.fetchQuery({ ...followListOptions(viewer, kind, viewer), staleTime: 0, retry: false })));
        }
        assertSession();
        await invalidateRelationships(client);
        assertSession();
        setUncertain(client, pair);
        return;
      } catch {
        throw new Error("仍无法核实关系，请稍后刷新核实");
      }
    }
    const options = { params: { path: { id: target } }, signal: AbortSignal.timeout(15000) };
    let uncertain = false;
    let failure: unknown;
    try {
      const result = action === "block"
        ? await apiClient.POST("/api/v1/users/me/block/{id}", options)
        : action === "unblock"
          ? await apiClient.DELETE("/api/v1/users/me/block/{id}", options)
          : action === "follow"
        ? await apiClient.POST("/api/v1/users/follow/{id}", options)
        : action === "unfollow"
          ? await apiClient.DELETE("/api/v1/users/follow/{id}", options)
          : await apiClient.DELETE("/api/v1/users/me/followers/{id}", options);
      if (result.error) {
        failure = result.error;
        uncertain = (result.response?.status ?? 500) >= 500;
      }
    } catch (error) {
      uncertain = true;
      failure = error;
    }
    assertSession();
    if (failure) {
      if (uncertain) {
        // 不重试写入；取消操作期间启动的旧读取，再直接核对两个方向。
        await client.cancelQueries({ queryKey: queryKeys.users.all });
        let confirmed = false;
        let verified = false;
        if (isBlockAction(action)) {
          try {
            const blocked = await readBlocked(client, viewer, target);
            verified = true;
            confirmed = blocked === (action === "block");
          } catch { /* 保持结果不明，禁止重复写入。 */ }
          assertSession();
          // 列表消失不代表关系被解除，拉黑状态只信任权威 isBlocked。
          if (verified) await resetBlockRelatedQueries(client);
        } else {
          const checks = await Promise.allSettled(
            (["following", "followers"] as const).map((kind) =>
              client.fetchQuery({ ...followListOptions(viewer, kind, viewer), staleTime: 0, retry: false })),
          );
          const relevant = checks[action === "removeFollower" ? 1 : 0];
          confirmed = relevant.status === "fulfilled" && (action === "follow"
            ? relevant.value.some((user) => user.id === target && user.viewerIsFollowing === true)
            : !relevant.value.some((user) => user.id === target));
          verified = checks.every((check) => check.status === "fulfilled");
        }
        assertSession();
        await invalidateRelationships(client);
        assertSession();
        if (confirmed) { setUncertain(client, pair); return; }
        setUncertain(client, pair, action);
        throw new Error(verified
          ? "请求结果未确认，请刷新核实后再操作"
          : "操作结果未确认，请刷新核实后再操作");
      }
      throw new Error(getApiErrorMessage(failure, "操作失败，请稍后重试"));
    }

    if (isBlockAction(action)) {
      await resetBlockRelatedQueries(client);
      assertSession();
      await invalidateRelationships(client);
      assertSession();
      return;
    }
    await client.cancelQueries({ queryKey: queryKeys.users.all });
    assertSession();
    for (const kind of ["following", "followers"] as const) {
      client.setQueryData<FollowUser[]>(
        queryKeys.users.followListsForViewer(kind, viewer, viewer),
        (users) => users?.flatMap((user) => {
          if (user.id !== target) return [user];
          if ((action === "unfollow" && kind === "following") ||
              (action === "removeFollower" && kind === "followers")) return [];
          return [{
            ...user,
            ...(action === "removeFollower"
              ? { viewerIsFollowedBy: false }
              : { viewerIsFollowing: action === "follow" }),
          }];
        }),
      );
    }
    await invalidateRelationships(client);
    assertSession();
  } finally {
    unsubscribe();
    pendingPairs.delete(pair);
    notify();
  }
}

export function useFollowActions(userId: string) {
  const client = useQueryClient();
  const viewer = useViewerScope();
  const mutationKey = queryKeys.users.relationshipMutation(viewer, userId);
  const pair = JSON.stringify([viewer, userId]);
  const isPending = useSyncExternalStore(subscribe, () => states(client).pending.has(pair), () => false);
  const needsReconciliation = useSyncExternalStore(subscribe, () => states(client).uncertain.has(pair), () => false);
  const follow = useMutation({ mutationKey, mutationFn: () => changeRelationship(client, viewer, userId, "follow"), retry: false });
  const unfollow = useMutation({ mutationKey, mutationFn: () => changeRelationship(client, viewer, userId, "unfollow"), retry: false });
  const removeFollower = useMutation({ mutationKey, mutationFn: () => changeRelationship(client, viewer, userId, "removeFollower"), retry: false });
  const reconcile = useMutation({ mutationKey, mutationFn: () => changeRelationship(client, viewer, userId, "reconcile"), retry: false });
  const block = useMutation({ mutationKey, mutationFn: () => changeRelationship(client, viewer, userId, "block"), retry: false });
  const unblock = useMutation({ mutationKey, mutationFn: () => changeRelationship(client, viewer, userId, "unblock"), retry: false });
  return { follow, unfollow, removeFollower, block, unblock, reconcile, isPending, needsReconciliation };
}
