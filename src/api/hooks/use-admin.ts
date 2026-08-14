"use client";

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient, setAdminCsrfToken } from "@/api/client";
import { queryKeys } from "@/api/query-keys";
import type { components, operations } from "@/api/types";
import type {
  AdminAccountsData,
  AdminContentType,
  AdminSessionData,
  CaseStatus,
  CaseSummary,
  CursorMeta,
  DecisionAction,
  ModerationCaseDetail,
  ModerationAppeal,
  NotificationCampaign,
  OperationalSettings,
  ReasonCode,
  TargetType,
} from "@/api/admin-types";

interface Envelope<T> {
  data: T;
  meta?: CursorMeta;
}

function envelope<T>(value: unknown): Envelope<T> {
  return value as Envelope<T>;
}

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
      const [overviewResult, timeseriesResult, distributionsResult, healthResult] =
        await Promise.all([
          apiClient.GET("/api/v1/admin/dashboard/overview"),
          apiClient.GET("/api/v1/admin/dashboard/timeseries"),
          apiClient.GET("/api/v1/admin/dashboard/distributions"),
          apiClient.GET("/api/v1/health"),
        ]);

      const failed = [overviewResult, timeseriesResult, distributionsResult, healthResult].find(
        (result) => result.error,
      );
      if (failed?.error) throw failed.error;

      return {
        overview: envelope<components["schemas"]["AdminDashboardOverviewResponseDto"]>(
          overviewResult.data,
        ).data,
        timeseries: envelope<components["schemas"]["AdminDashboardTimeseriesResponseDto"]>(
          timeseriesResult.data,
        ).data,
        distributions: envelope<components["schemas"]["AdminDashboardDistributionsResponseDto"]>(
          distributionsResult.data,
        ).data,
        health: envelope<{
          status?: string;
          info?: Record<string, { status: string }>;
        }>(healthResult.data).data,
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
      const { data, error } = await apiClient.POST("/api/v1/admin/accounts/invites", {
        body: { userId },
      });
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
    onSuccess: (settings) => {
      queryClient.setQueryData(queryKeys.admin.settings, settings);
    },
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

export type AdminUser = components["schemas"]["AdminUserModerationResponseDto"];
export type AdminUserFilters = NonNullable<
  operations["adminModerationListUsers"]["parameters"]["query"]
>;

export function useAdminUsers(filters: AdminUserFilters) {
  return useQuery({
    queryKey: queryKeys.admin.users(filters),
    queryFn: async () => {
      const { data, error } = await apiClient.GET("/api/v1/admin/users", {
        params: { query: { ...filters, limit: filters.limit ?? 20 } },
      });
      if (error) throw error;
      const result = envelope<AdminUser[]>(data);
      return { items: result.data, meta: result.meta };
    },
    placeholderData: keepPreviousData,
  });
}

export function useAdminUserActions() {
  const queryClient = useQueryClient();
  const refresh = () => queryClient.invalidateQueries({ queryKey: queryKeys.admin.usersRoot });
  const sanction = useMutation({
    mutationFn: async ({ id, ...body }: { id: string } & components["schemas"]["SanctionUserDto"]) => {
      const { data, error } = await apiClient.POST("/api/v1/admin/users/{id}/sanctions", {
        params: { path: { id } },
        body,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: refresh,
  });
  const revoke = useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) => {
      const { data, error } = await apiClient.POST("/api/v1/admin/users/{id}/sanctions/current/revoke", {
        params: { path: { id } },
        body: { reason },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: refresh,
  });
  return { sanction, revoke };
}

export interface AdminContentActionInput {
  type: AdminContentType;
  id: string;
  reason: string;
}

/** 站务内容处置统一写入口；成功后让公开读路径与审计轨迹立即刷新。 */
export function useAdminContentActions() {
  const queryClient = useQueryClient();
  const refresh = ({ type, id }: AdminContentActionInput) => {
    const shared = [
      queryClient.invalidateQueries({ queryKey: queryKeys.admin.auditsRoot }),
      queryClient.invalidateQueries({ queryKey: queryKeys.admin.dashboard }),
      queryClient.invalidateQueries({ queryKey: queryKeys.users.all }),
    ];

    if (type === "thread") {
      return Promise.all([
        ...shared,
        queryClient.invalidateQueries({ queryKey: queryKeys.threads.all }),
        queryClient.invalidateQueries({ queryKey: queryKeys.threads.detail(id) }),
      ]);
    }
    if (type === "post") {
      return Promise.all([
        ...shared,
        queryClient.invalidateQueries({ queryKey: queryKeys.floors.all }),
        queryClient.invalidateQueries({ queryKey: queryKeys.replies.all }),
        queryClient.invalidateQueries({ queryKey: queryKeys.posts.detail(id) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.threads.all }),
      ]);
    }
    return Promise.all([
      ...shared,
      queryClient.invalidateQueries({ queryKey: queryKeys.moments.all }),
    ]);
  };

  const hide = useMutation({
    mutationFn: async ({ type, id, reason }: AdminContentActionInput) => {
      const { data, error } = await apiClient.POST("/api/v1/admin/content/{type}/{id}/hide", {
        params: { path: { type, id } },
        body: { reason },
      });
      if (error) throw error;
      return envelope<components["schemas"]["AdminContentModerationResponseDto"]>(data).data;
    },
    onSuccess: (_data, variables) => refresh(variables),
  });

  const restore = useMutation({
    mutationFn: async ({ type, id, reason }: AdminContentActionInput) => {
      const { data, error } = await apiClient.POST("/api/v1/admin/content/{type}/{id}/restore", {
        params: { path: { type, id } },
        body: { reason },
      });
      if (error) throw error;
      return envelope<components["schemas"]["AdminContentModerationResponseDto"]>(data).data;
    },
    onSuccess: (_data, variables) => refresh(variables),
  });

  return { hide, restore };
}

export type AdminAuditLog = components["schemas"]["AdminAuditLogResponseDto"];
export type AdminAuditFilters = NonNullable<
  operations["adminModerationListAuditLogs"]["parameters"]["query"]
>;

export function useAdminAuditLogs(filters: AdminAuditFilters) {
  return useQuery({
    queryKey: queryKeys.admin.audits(filters),
    queryFn: async () => {
      const { data, error } = await apiClient.GET("/api/v1/admin/audit-logs", {
        params: { query: { ...filters, limit: filters.limit ?? 20 } },
      });
      if (error) throw error;
      const result = envelope<AdminAuditLog[]>(data);
      return { items: result.data, meta: result.meta };
    },
    placeholderData: keepPreviousData,
  });
}

export function useAdminTaxonomy() {
  return useQuery({
    queryKey: queryKeys.admin.taxonomy,
    queryFn: async () => {
      const [categories, tags] = await Promise.all([
        apiClient.GET("/api/v1/admin/thread-categories"),
        apiClient.GET("/api/v1/admin/tags"),
      ]);
      if (categories.error) throw categories.error;
      if (tags.error) throw tags.error;
      return { categories: categories.data.data, tags: tags.data.data };
    },
  });
}

export function useAdminTaxonomyActions() {
  const queryClient = useQueryClient();
  const refreshCategories = () => Promise.all([
    queryClient.invalidateQueries({ queryKey: queryKeys.admin.taxonomy }),
    queryClient.invalidateQueries({ queryKey: queryKeys.threadCategories }),
  ]);
  const refreshTags = () => Promise.all([
    queryClient.invalidateQueries({ queryKey: queryKeys.admin.taxonomy }),
    queryClient.invalidateQueries({ queryKey: queryKeys.topicTagsRoot }),
  ]);
  const createCategory = useMutation({
    mutationFn: async (body: components["schemas"]["CreateThreadCategoryDto"]) => {
      const { data, error } = await apiClient.POST("/api/v1/admin/thread-categories", { body });
      if (error) throw error;
      return data;
    },
    onSuccess: refreshCategories,
  });
  const updateCategory = useMutation({
    mutationFn: async ({ id, ...body }: components["schemas"]["UpdateThreadCategoryDto"] & { id: string }) => {
      const { data, error } = await apiClient.PATCH("/api/v1/admin/thread-categories/{id}", {
        params: { path: { id } },
        body,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: refreshCategories,
  });
  const createTag = useMutation({
    mutationFn: async (body: components["schemas"]["CreateManagedTagDto"]) => {
      const { data, error } = await apiClient.POST("/api/v1/admin/tags", { body });
      if (error) throw error;
      return data;
    },
    onSuccess: refreshTags,
  });
  const updateTag = useMutation({
    mutationFn: async ({ id, ...body }: components["schemas"]["UpdateManagedTagDto"] & { id: string }) => {
      const { data, error } = await apiClient.PATCH("/api/v1/admin/tags/{id}", {
        params: { path: { id } },
        body,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: refreshTags,
  });
  return { createCategory, updateCategory, createTag, updateTag };
}

export type NotificationCampaignFilters = NonNullable<
  operations["notificationCampaignList"]["parameters"]["query"]
>;

export function useNotificationCampaigns(filters: NotificationCampaignFilters) {
  return useQuery({
    queryKey: queryKeys.admin.announcements(filters),
    queryFn: async () => {
      const { data, error } = await apiClient.GET("/api/v1/admin/notification-campaigns", {
        params: { query: { ...filters, limit: filters.limit ?? 20 } },
      });
      if (error) throw error;
      const result = envelope<NotificationCampaign[]>(data);
      return { items: result.data, meta: result.meta };
    },
    placeholderData: keepPreviousData,
  });
}

export function useNotificationCampaignActions() {
  const queryClient = useQueryClient();
  const refresh = () => queryClient.invalidateQueries({ queryKey: queryKeys.admin.announcementsRoot });
  const preview = useMutation({
    mutationFn: async (body: components["schemas"]["NotificationAudienceDto"]) => {
      const { data, error } = await apiClient.POST("/api/v1/admin/notification-campaigns/preview", { body });
      if (error) throw error;
      return envelope<{ recipientCount: number }>(data).data;
    },
  });
  const create = useMutation({
    mutationFn: async (body: components["schemas"]["CreateNotificationCampaignDto"]) => {
      const { data, error } = await apiClient.POST("/api/v1/admin/notification-campaigns", { body });
      if (error) throw error;
      return data;
    },
    onSuccess: refresh,
  });
  const cancel = useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await apiClient.DELETE("/api/v1/admin/notification-campaigns/{id}", {
        params: { path: { id } },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: refresh,
  });
  return { preview, create, cancel };
}
