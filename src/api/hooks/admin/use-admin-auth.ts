"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { clearAdminListPagination } from "@/hooks/use-cursor-pagination";
import { clearAdminListPositions } from "@/hooks/use-admin-list-return";
import { apiClient, setAdminCsrfToken } from "@/api/client";
import { queryKeys } from "@/api/query-keys";
import type { components } from "@/api/types";
import type { AdminSessionData } from "@/api/admin-types";
import { envelope } from "@/api/hooks/admin/envelope";

let adminIdentity: string | undefined;
function clearAdminNavigation() {
  clearAdminListPagination();
  clearAdminListPositions();
  adminIdentity = undefined;
}
function acceptAdminIdentity(id: string) {
  if (adminIdentity !== id) clearAdminNavigation();
  adminIdentity = id;
}

export function useAdminSession(enabled = true) {
  return useQuery({
    queryKey: queryKeys.admin.session,
    queryFn: async () => {
      const { data, error, response } = await apiClient.GET("/api/v1/admin/auth/session");
      if (error) {
        if (response.status === 401 || response.status === 403) clearAdminNavigation();
        throw error;
      }
      const session = envelope<AdminSessionData>(data).data;
      acceptAdminIdentity(session.user.id);
      setAdminCsrfToken(session.csrfToken);
      return session;
    },
    retry: false,
    staleTime: 30_000,
    enabled,
  });
}

export function useAdminLogin() {
  const queryClient = useQueryClient();
  const challenge = useMutation({
    mutationFn: async (body: components["schemas"]["AdminLoginChallengeDto"]) => {
      const { data, error } = await apiClient.POST("/api/v1/admin/auth/challenge", { body });
      if (error) throw error;
      return envelope<{ challengeId: string; expiresIn: number }>(data).data;
    },
  });
  const verify = useMutation({
    mutationFn: async (body: components["schemas"]["AdminChallengeVerifyDto"]) => {
      const { data, error } = await apiClient.POST("/api/v1/admin/auth/verify", { body });
      if (error) throw error;
      return envelope<AdminSessionData>(data).data;
    },
    onSuccess: (session) => {
      clearAdminNavigation();
      acceptAdminIdentity(session.user.id);
      setAdminCsrfToken(session.csrfToken);
      queryClient.setQueryData(queryKeys.admin.session, session);
    },
  });
  return { challenge, verify };
}

export function useAdminLogout() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { error } = await apiClient.POST("/api/v1/admin/auth/logout");
      if (error) throw error;
    },
    onSuccess: () => {
      setAdminCsrfToken(null);
      clearAdminNavigation();
      queryClient.removeQueries({ queryKey: queryKeys.admin.root });
    },
  });
}

export function useAdminDashboard(range: { from?: string; to?: string } = {}) {
  return useQuery({
    queryKey: queryKeys.admin.dashboardRange(range),
    queryFn: async () => {
      const [overviewResult, timeseriesResult, distributionsResult] = await Promise.all([
        apiClient.GET("/api/v1/admin/dashboard/overview", { params: { query: range } }),
        apiClient.GET("/api/v1/admin/dashboard/timeseries", { params: { query: range } }),
        apiClient.GET("/api/v1/admin/dashboard/distributions"),
      ]);
      const failed = [overviewResult, timeseriesResult, distributionsResult]
        .find((result) => result.error);
      if (failed?.error) throw failed.error;
      return {
        overview: envelope<components["schemas"]["AdminDashboardOverviewResponseDto"]>(overviewResult.data).data,
        timeseries: envelope<components["schemas"]["AdminDashboardTimeseriesResponseDto"]>(timeseriesResult.data).data,
        distributions: envelope<components["schemas"]["AdminDashboardDistributionsResponseDto"]>(distributionsResult.data).data,
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
      return envelope<{ status?: string; info?: Record<string, { status: string }> }>(data).data;
    },
    retry: false,
    refetchInterval: 60_000,
  });
}

export function useAcceptAdminInvite() {
  return useMutation({
    mutationFn: async (token: string) => {
      const { data, error } = await apiClient.POST("/api/v1/admin-invitations/{token}/accept", {
        params: { path: { token } },
      });
      if (error) throw error;
      return data;
    },
  });
}

export function useAdminStepUp() {
  const queryClient = useQueryClient();
  const challenge = useMutation({
    mutationFn: async () => {
      const { data, error } = await apiClient.POST("/api/v1/admin/auth/step-up/challenge");
      if (error) throw error;
      return envelope<{ challengeId: string; expiresIn: number }>(data).data;
    },
  });
  const verify = useMutation({
    mutationFn: async (body: components["schemas"]["AdminChallengeVerifyDto"]) => {
      const { data, error } = await apiClient.POST("/api/v1/admin/auth/step-up/verify", { body });
      if (error) throw error;
      return envelope<{ elevatedUntil: string }>(data).data;
    },
    onSuccess: ({ elevatedUntil }) => {
      queryClient.setQueryData<AdminSessionData>(queryKeys.admin.session, (current) =>
        current
          ? { ...current, session: { ...current.session, elevatedUntil } }
          : current,
      );
    },
  });
  return { challenge, verify };
}
