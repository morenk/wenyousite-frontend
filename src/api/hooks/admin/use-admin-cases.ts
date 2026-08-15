"use client";

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/api/client";
import { queryKeys } from "@/api/query-keys";
import type { components, operations } from "@/api/types";
import type {
  AdminAccountsData,
  CaseStatus,
  CaseSummary,
  DecisionAction,
  ModerationAppeal,
  ModerationCaseDetail,
  OperationalSettings,
  ReasonCode,
  TargetType,
} from "@/api/admin-types";
import { envelope } from "@/api/hooks/admin/envelope";

export interface CaseFilters {
  status?: CaseStatus;
  targetType?: TargetType;
  reasonCode?: ReasonCode;
  cursor?: string;
  limit?: number;
}

export function useAdminCases(filters: CaseFilters) {
  return useQuery({
    queryKey: queryKeys.admin.cases(filters),
    queryFn: async () => {
      const { data, error } = await apiClient.GET("/api/v1/admin/cases", {
        params: { query: { ...filters, limit: filters.limit ?? 30 } },
      });
      if (error) throw error;
      const result = envelope<CaseSummary[]>(data);
      return { items: result.data, meta: result.meta };
    },
    placeholderData: keepPreviousData,
  });
}

export function useAdminCase(id?: string) {
  return useQuery({
    queryKey: queryKeys.admin.case(id),
    queryFn: async () => {
      const { data, error } = await apiClient.GET("/api/v1/admin/cases/{id}", {
        params: { path: { id: id! } },
      });
      if (error) throw error;
      return envelope<ModerationCaseDetail>(data).data;
    },
    enabled: Boolean(id),
  });
}

export interface ResolveCaseInput {
  id: string;
  outcome: "RESOLVED" | "DISMISSED";
  action?: DecisionAction;
  policyCode: ReasonCode;
  publicExplanation: string;
  internalNote?: string;
  suspendUntil?: string;
}

export function useResolveAdminCase() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...body }: ResolveCaseInput) => {
      const { data, error } = await apiClient.POST("/api/v1/admin/cases/{id}/resolve", {
        params: { path: { id } },
        body,
      });
      if (error) throw error;
      return envelope<ModerationCaseDetail>(data).data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.admin.casesRoot });
      queryClient.invalidateQueries({ queryKey: queryKeys.admin.case(variables.id) });
    },
  });
}

export function useAdminAccounts(enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.admin.accounts,
    queryFn: async () => {
      const { data, error } = await apiClient.GET("/api/v1/admin/accounts");
      if (error) throw error;
      return envelope<AdminAccountsData>(data).data;
    },
    enabled,
  });
}

export function useAdminAccountActions() {
  const queryClient = useQueryClient();
  const invalidate = () => queryClient.invalidateQueries({ queryKey: queryKeys.admin.accounts });
  const invite = useMutation({
    mutationFn: async (userId: string) => {
      const { data, error } = await apiClient.POST("/api/v1/admin/accounts/invites", { body: { userId } });
      if (error) throw error;
      return data;
    },
    onSuccess: invalidate,
  });
  const cancelInvite = useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) => {
      const { data, error } = await apiClient.DELETE("/api/v1/admin/accounts/invites/{id}", {
        params: { path: { id } },
        body: { reason },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: invalidate,
  });
  const revoke = useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) => {
      const { data, error } = await apiClient.DELETE("/api/v1/admin/accounts/{id}", {
        params: { path: { id } },
        body: { reason },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: invalidate,
  });
  const transfer = useMutation({
    mutationFn: async ({ userId, reason }: { userId: string; reason: string }) => {
      const { data, error } = await apiClient.POST("/api/v1/admin/accounts/transfer-super-admin", {
        body: { userId, reason },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: invalidate,
  });
  return { invite, cancelInvite, revoke, transfer };
}

export function useAdminUserSearch(query: string) {
  return useQuery({
    queryKey: queryKeys.admin.userSearch(query),
    queryFn: async () => {
      const { data, error } = await apiClient.GET("/api/v1/admin/users/search", {
        params: { query: { q: query } },
      });
      if (error) throw error;
      return data.data.data;
    },
    enabled: query.trim().length >= 2,
    staleTime: 15_000,
  });
}

export function useAdminSettings() {
  return useQuery({
    queryKey: queryKeys.admin.settings,
    queryFn: async () => {
      const { data, error } = await apiClient.GET("/api/v1/admin/operations/settings");
      if (error) throw error;
      return envelope<OperationalSettings>(data).data;
    },
  });
}

export function useUpdateAdminSettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: components["schemas"]["UpdateSiteSettingsDto"]) => {
      const { data, error } = await apiClient.PATCH("/api/v1/admin/operations/settings", { body });
      if (error) throw error;
      return envelope<OperationalSettings>(data).data;
    },
    onSuccess: (settings) => queryClient.setQueryData(queryKeys.admin.settings, settings),
  });
}

export type AdminAppealFilters = NonNullable<
  operations["adminModerationAppealsList"]["parameters"]["query"]
>;

export function useAdminAppeals(filters: AdminAppealFilters) {
  return useQuery({
    queryKey: queryKeys.admin.appeals(filters),
    queryFn: async () => {
      const { data, error } = await apiClient.GET("/api/v1/admin/appeals", {
        params: { query: { ...filters, limit: filters.limit ?? 20 } },
      });
      if (error) throw error;
      const result = envelope<ModerationAppeal[]>(data);
      return { items: result.data, meta: result.meta };
    },
    placeholderData: keepPreviousData,
  });
}

export function useResolveAdminAppeal() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, outcome, note }: { id: string; outcome: "UPHELD" | "OVERTURNED"; note: string }) => {
      const { data, error } = await apiClient.POST("/api/v1/admin/appeals/{id}/resolve", {
        params: { path: { id } },
        body: { outcome, note },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.admin.appealsRoot });
      queryClient.invalidateQueries({ queryKey: queryKeys.admin.casesRoot });
    },
  });
}
