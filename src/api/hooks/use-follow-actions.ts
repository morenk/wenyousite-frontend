/** 三种关系写入共用缓存、身份保护与结果不明的只读核对。 */

import { useSyncExternalStore } from "react";
import { useIsMutating, useMutation, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { apiClient } from "@/api/client";
import { getApiErrorMessage } from "@/api/errors";
import { queryKeys } from "@/api/query-keys";
import { useViewerScope } from "@/api/use-viewer-scope";
import { getAuthSnapshot, subscribeAuthStore } from "@/lib/auth-store";
import { followListOptions, type FollowUser } from "./use-user-follow-list";

const pairStates = new WeakMap<QueryClient, { pending: Set<string>; uncertain: Set<string> }>();
function states(client: QueryClient) {
  let value = pairStates.get(client);
  if (!value) { value = { pending: new Set(), uncertain: new Set() }; pairStates.set(client, value); }
  return value;
}
const listeners = new Set<() => void>();
function subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; }
function setUncertain(client: QueryClient, pair: string, value: boolean) {
  if (value) states(client).uncertain.add(pair); else states(client).uncertain.delete(pair);
  for (const listener of listeners) listener();
}
type RelationAction = "follow" | "unfollow" | "removeFollower";

async function invalidateRelationships(client: QueryClient) {
  await Promise.all([
    client.invalidateQueries({ queryKey: queryKeys.users.all }),
    client.invalidateQueries({ queryKey: queryKeys.me }),
  ]);
}

async function changeRelationship(client: QueryClient, viewer: string, target: string, action: RelationAction | "reconcile") {
  const pair = JSON.stringify([viewer, target]);
  const { pending: pendingPairs, uncertain: uncertainPairs } = states(client);
  if (pendingPairs.has(pair)) throw new Error("该用户的关系正在更新");
  if (action !== "reconcile" && uncertainPairs.has(pair)) throw new Error("请先刷新核实关系");
  pendingPairs.add(pair);
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
        await Promise.all((["following", "followers"] as const).map((kind) =>
          client.fetchQuery({ ...followListOptions(viewer, kind, viewer), staleTime: 0, retry: false })));
        assertSession();
        setUncertain(client, pair, false);
        await invalidateRelationships(client);
        assertSession();
        return;
      } catch {
        throw new Error("仍无法核实关系，请稍后刷新核实");
      }
    }
    const options = { params: { path: { id: target } }, signal: AbortSignal.timeout(15000) };
    let uncertain = false;
    let failure: unknown;
    try {
      const result = action === "follow"
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
        const checks = await Promise.allSettled(
          (["following", "followers"] as const).map((kind) =>
            client.fetchQuery({ ...followListOptions(viewer, kind, viewer), staleTime: 0, retry: false })),
        );
        assertSession();
        const relevant = checks[action === "removeFollower" ? 1 : 0];
        const confirmed = relevant.status === "fulfilled" && (action === "follow"
          ? relevant.value.some((user) => user.id === target && user.viewerIsFollowing === true)
          : !relevant.value.some((user) => user.id === target));
        await invalidateRelationships(client);
        assertSession();
        if (confirmed) { setUncertain(client, pair, false); return; }
        const verified = checks.every((check) => check.status === "fulfilled");
        setUncertain(client, pair, !verified);
        throw new Error(verified
          ? "请求结果未确认，已刷新最新关系，请核对后再操作"
          : "操作结果未确认，请刷新核实后再操作");
      }
      throw new Error(getApiErrorMessage(failure, "操作失败，请稍后重试"));
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
  }
}

export function useFollowActions(userId: string) {
  const client = useQueryClient();
  const viewer = useViewerScope();
  const mutationKey = queryKeys.users.relationshipMutation(viewer, userId);
  const pendingCount = useIsMutating({ mutationKey });
  const pair = JSON.stringify([viewer, userId]);
  const needsReconciliation = useSyncExternalStore(subscribe, () => states(client).uncertain.has(pair), () => false);
  const follow = useMutation({ mutationKey, mutationFn: () => changeRelationship(client, viewer, userId, "follow"), retry: false });
  const unfollow = useMutation({ mutationKey, mutationFn: () => changeRelationship(client, viewer, userId, "unfollow"), retry: false });
  const removeFollower = useMutation({ mutationKey, mutationFn: () => changeRelationship(client, viewer, userId, "removeFollower"), retry: false });
  const reconcile = useMutation({ mutationKey, mutationFn: () => changeRelationship(client, viewer, userId, "reconcile"), retry: false });
  return { follow, unfollow, removeFollower, reconcile, isPending: pendingCount > 0, needsReconciliation };
}
