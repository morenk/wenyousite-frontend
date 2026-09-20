"use client";

import { useEffect, useRef, useSyncExternalStore } from "react";
import {
  ADMIN_SESSION_EVENT_KEY,
  acceptAdminSession,
  announceAdminSession,
  beginAdminSessionChange,
  expireAdminSession,
  getAdminCsrfToken,
  getAdminSessionSnapshot,
  getServerAdminSessionSnapshot,
  markAdminChecking,
  markAdminUnavailable,
  registerAdminReset,
  subscribeAdminSession,
  updateAdminElevation,
} from "@/lib/admin-session-store";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { clearAdminListPagination } from "@/hooks/use-cursor-pagination";
import { clearAdminListPositions } from "@/hooks/use-admin-list-return";
import { getApiError } from "@/api/errors";
import { apiClient } from "@/api/client";
import { queryKeys } from "@/api/query-keys";
import type { components } from "@/api/types";
import type { AdminSessionData } from "@/api/admin-types";
import { envelope } from "@/api/hooks/admin/envelope";

const boundClients = new WeakMap<
  object,
  { count: number; dispose: () => void }
>();
export function bindAdminClient(client: ReturnType<typeof useQueryClient>) {
  let binding = boundClients.get(client);
  if (!binding) {
    const dispose = registerAdminReset(() => {
      void client.cancelQueries({ queryKey: queryKeys.admin.root });
      client.removeQueries({ queryKey: queryKeys.admin.root });
      clearAdminListPagination();
      clearAdminListPositions();
    });
    binding = { count: 0, dispose };
    boundClients.set(client, binding);
  }
  binding.count++;
  return () => {
    if (--binding.count === 0) {
      binding.dispose();
      boundClients.delete(client);
    }
  };
}
export function useAdminSession(enabled = true) {
  const client = useQueryClient();
  const state = useSyncExternalStore(
    subscribeAdminSession,
    getAdminSessionSnapshot,
    getServerAdminSessionSnapshot,
  );
  useEffect(() => bindAdminClient(client), [client]);
  const query = useQuery({
    queryKey: queryKeys.admin.session,
    queryFn: async ({ signal }) => {
      if (getAdminSessionSnapshot().operation)
        throw new DOMException("登录状态正在更新", "AbortError");
      const generation = markAdminChecking();
      try {
        const { data, error, response } = await apiClient.GET(
          "/api/v1/admin/auth/session",
          { signal },
        );
        if (error) {
          if (
            response.status === 401 &&
            (error.code === 40117 || error.code === 40118)
          )
            expireAdminSession(
              generation,
              error.code === 40118 ? "expired" : undefined,
            );
          throw error;
        }
        const session = envelope<AdminSessionData>(data).data;
        if (!acceptAdminSession(session, generation))
          throw new DOMException("过期的管理会话", "AbortError");
        return session;
      } catch (error) {
        markAdminUnavailable(generation);
        throw error;
      }
    },
    retry: false,
    staleTime: Infinity,
    refetchOnMount: false,
    refetchOnWindowFocus: "always",
    refetchOnReconnect: "always",
    enabled: enabled && !state.operation && state.status !== "unauthenticated",
  });
  return {
    ...query,
    data: state.status === "unauthenticated" ? undefined : state.data,
    sessionStatus: state.status,
    generation: state.generation,
    reason: state.reason,
  };
}

/** 由后台 Provider 单次挂载：跨标签变化与绝对到期复核，不做定时保活。 */
export function useAdminSessionLifecycle() {
  const client = useQueryClient();
  const session = useAdminSession();
  const expiryChecked = useRef<string | undefined>(undefined);
  const refetch = session.refetch;
  useEffect(() => {
    const state = getAdminSessionSnapshot();
    if (state.status !== "checking" && !state.operation) void refetch();
  }, [refetch]);
  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key !== ADMIN_SESSION_EVENT_KEY || !event.newValue) return;
      beginAdminSessionChange();
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [refetch]);
  useEffect(() => {
    const onFocus = () => {
      const state = getAdminSessionSnapshot();
      if (
        state.operation ||
        state.status === "unauthenticated" ||
        document.visibilityState === "hidden"
      )
        return;
      if (
        client.getQueryState(queryKeys.admin.session)?.fetchStatus ===
        "fetching"
      )
        return;
      void refetch({ cancelRefetch: false });
    };
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [client, refetch]);
  const expiresAt = session.data?.session.expiresAt;
  useEffect(() => {
    if (!expiresAt) return;
    const key = `${session.generation}:${expiresAt}`;
    if (expiryChecked.current === key) return;
    const expires = Date.parse(expiresAt);
    if (!Number.isFinite(expires)) return;
    const timer = window.setTimeout(
      () => {
        expiryChecked.current = key;
        void refetch();
      },
      Math.min(2_147_483_647, Math.max(0, expires - Date.now())),
    );
    return () => window.clearTimeout(timer);
  }, [expiresAt, session.generation, refetch]);
}

export function useAdminLogin() {
  const queryClient = useQueryClient();
  useEffect(() => bindAdminClient(queryClient), [queryClient]);
  const challenge = useMutation({
    mutationFn: async (
      body: components["schemas"]["AdminLoginChallengeDto"],
    ) => {
      const { data, error } = await apiClient.POST(
        "/api/v1/admin/auth/challenge",
        { body },
      );
      if (error) throw error;
      return envelope<{ challengeId: string; expiresIn: number }>(data).data;
    },
  });
  const verify = useMutation({
    mutationFn: async (body: components["schemas"]["AdminLoginVerifyDto"]) => {
      const generation = beginAdminSessionChange("login");
      try {
        const { data, error } = await apiClient.POST(
          "/api/v1/admin/auth/verify",
          { body },
        );
        if (error) throw error;
        const session = envelope<AdminSessionData>(data).data;
        if (!acceptAdminSession(session, generation))
          throw new DOMException("过期的登录结果", "AbortError");
        queryClient.setQueryData(queryKeys.admin.session, session);
        announceAdminSession();
        return session;
      } catch (error) {
        const { code } = getApiError(error);
        if (
          code !== undefined &&
          code >= 40000 &&
          code < 50000 &&
          code !== 42900
        ) {
          expireAdminSession(generation);
        } else {
          markAdminUnavailable(generation);
        }
        throw error;
      }
    },
  });
  return { challenge, verify };
}

export function useAdminLogout() {
  const queryClient = useQueryClient();
  useEffect(() => bindAdminClient(queryClient), [queryClient]);
  return useMutation({
    mutationFn: async () => {
      const token = getAdminCsrfToken();
      const generation = beginAdminSessionChange("logout");
      try {
        const { error, response } = await apiClient.POST("/api/v1/admin/auth/logout", {
          headers: token ? { "X-CSRF-Token": token } : undefined,
        });
        if (error) {
          if (response.status === 401 && (error.code === 40117 || error.code === 40118)) {
            expireAdminSession(generation, "logout");
            return;
          }
          throw error;
        }
        expireAdminSession(generation, "logout");
      } catch (error) {
        markAdminUnavailable(generation);
        throw error;
      }
    },
  });
}

export function useAdminDashboard(range: { from?: string; to?: string } = {}) {
  return useQuery({
    queryKey: queryKeys.admin.dashboardRange(range),
    queryFn: async () => {
      const [overviewResult, timeseriesResult, distributionsResult] =
        await Promise.all([
          apiClient.GET("/api/v1/admin/dashboard/overview", {
            params: { query: range },
          }),
          apiClient.GET("/api/v1/admin/dashboard/timeseries", {
            params: { query: range },
          }),
          apiClient.GET("/api/v1/admin/dashboard/distributions"),
        ]);
      const failed = [
        overviewResult,
        timeseriesResult,
        distributionsResult,
      ].find((result) => result.error);
      if (failed?.error) throw failed.error;
      return {
        overview: envelope<
          components["schemas"]["AdminDashboardOverviewResponseDto"]
        >(overviewResult.data).data,
        timeseries: envelope<
          components["schemas"]["AdminDashboardTimeseriesResponseDto"]
        >(timeseriesResult.data).data,
        distributions: envelope<
          components["schemas"]["AdminDashboardDistributionsResponseDto"]
        >(distributionsResult.data).data,
      };
    },
    refetchInterval: 60_000,
  });
}

export function useAdminHealth() {
  return useQuery({
    queryKey: queryKeys.admin.health,
    queryFn: async () => {
      const { data, error } = await apiClient.GET("/api/v1/health");
      if (error) throw error;
      return envelope<{
        status?: string;
        info?: Record<string, { status: string }>;
      }>(data).data;
    },
    retry: false,
    refetchInterval: 60_000,
  });
}

export function useAcceptAdminInvite() {
  return useMutation({
    mutationFn: async (token: string) => {
      const { data, error } = await apiClient.POST(
        "/api/v1/admin-invitations/{token}/accept",
        {
          params: { path: { token } },
        },
      );
      if (error) throw error;
      return data;
    },
  });
}

export function useAdminStepUp() {
  const queryClient = useQueryClient();
  const challenge = useMutation({
    mutationFn: async () => {
      const { data, error } = await apiClient.POST(
        "/api/v1/admin/auth/step-up/challenge",
      );
      if (error) throw error;
      return envelope<{ challengeId: string; expiresIn: number }>(data).data;
    },
  });
  const verify = useMutation({
    mutationFn: async (
      body: components["schemas"]["AdminChallengeVerifyDto"],
    ) => {
      const generation = getAdminSessionSnapshot().generation;
      const { data, error } = await apiClient.POST(
        "/api/v1/admin/auth/step-up/verify",
        { body },
      );
      if (error) throw error;
      return { ...envelope<{ elevatedUntil: string }>(data).data, generation };
    },
    onSuccess: ({ elevatedUntil, generation }) => {
      if (generation !== getAdminSessionSnapshot().generation) return;
      updateAdminElevation(elevatedUntil, generation);
      queryClient.setQueryData<AdminSessionData>(
        queryKeys.admin.session,
        (current) =>
          current
            ? { ...current, session: { ...current.session, elevatedUntil } }
            : current,
      );
    },
  });
  return { challenge, verify };
}
