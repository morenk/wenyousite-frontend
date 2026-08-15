"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient, setAdminCsrfToken } from "@/api/client";
import { queryKeys } from "@/api/query-keys";
import type { components } from "@/api/types";
import type { AdminSessionData } from "@/api/admin-types";
import { envelope } from "@/api/hooks/admin/envelope";

export function useAdminSession(enabled = true) {
  return useQuery({
    queryKey: queryKeys.admin.session,
    queryFn: async () => {
      const { data, error } = await apiClient.GET("/api/v1/admin/auth/session");
      if (error) throw error;
      const session = envelope<AdminSessionData>(data).data;
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
      queryClient.removeQueries({ queryKey: queryKeys.admin.root });
    },
  });
}

export function useAdminDashboard() {
  return useQuery({
    queryKey: queryKeys.admin.dashboard,
    queryFn: async () => {
      const [overviewResult, timeseriesResult, distributionsResult, healthResult] = await Promise.all([
        apiClient.GET("/api/v1/admin/dashboard/overview"),
        apiClient.GET("/api/v1/admin/dashboard/timeseries"),
        apiClient.GET("/api/v1/admin/dashboard/distributions"),
        apiClient.GET("/api/v1/health"),
      ]);
      const failed = [overviewResult, timeseriesResult, distributionsResult, healthResult]
        .find((result) => result.error);
      if (failed?.error) throw failed.error;
      return {
        overview: envelope<components["schemas"]["AdminDashboardOverviewResponseDto"]>(overviewResult.data).data,
        timeseries: envelope<components["schemas"]["AdminDashboardTimeseriesResponseDto"]>(timeseriesResult.data).data,
        distributions: envelope<components["schemas"]["AdminDashboardDistributionsResponseDto"]>(distributionsResult.data).data,
        health: envelope<{ status?: string; info?: Record<string, { status: string }> }>(healthResult.data).data,
      };
    },
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
