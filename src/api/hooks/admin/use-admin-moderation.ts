"use client";

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/api/client";
import { queryKeys } from "@/api/query-keys";
import type { components, operations } from "@/api/types";
import type { AdminContentType } from "@/api/admin-types";
import { envelope } from "@/api/hooks/admin/envelope";

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

export type AdminHiddenContent = components["schemas"]["AdminHiddenContentResponseDto"];
export type AdminHiddenContentFilters = NonNullable<
  operations["adminModerationListHiddenContent"]["parameters"]["query"]
>;

export function useAdminHiddenContent(filters: AdminHiddenContentFilters) {
  return useQuery({
    queryKey: queryKeys.admin.hiddenContent(filters),
    queryFn: async () => {
      const { data, error } = await apiClient.GET("/api/v1/admin/content/hidden", {
        params: { query: { ...filters, limit: filters.limit ?? 20 } },
      });
      if (error) throw error;
      const result = envelope<AdminHiddenContent[]>(data);
      return { items: result.data, meta: result.meta };
    },
    placeholderData: keepPreviousData,
  });
}

function useContentModerationRefresh() {
  const queryClient = useQueryClient();
  return ({ type, id }: AdminContentActionInput, hidden: boolean) => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.admin.hiddenContentRoot });
    void queryClient.invalidateQueries({ queryKey: queryKeys.admin.auditsRoot });
    void queryClient.invalidateQueries({ queryKey: queryKeys.admin.dashboard });
    void queryClient.invalidateQueries({ queryKey: queryKeys.users.all });
    if (type === "thread") {
      void queryClient.invalidateQueries({ queryKey: queryKeys.threads.all });
      if (hidden) queryClient.removeQueries({ queryKey: queryKeys.threads.detail(id) });
      else void queryClient.invalidateQueries({ queryKey: queryKeys.threads.detail(id) });
      return;
    }
    if (type === "post") {
      void queryClient.invalidateQueries({ queryKey: queryKeys.floors.all });
      void queryClient.invalidateQueries({ queryKey: queryKeys.replies.all });
      void queryClient.invalidateQueries({ queryKey: queryKeys.threads.all });
      if (hidden) queryClient.removeQueries({ queryKey: queryKeys.posts.detail(id) });
      else void queryClient.invalidateQueries({ queryKey: queryKeys.posts.detail(id) });
      return;
    }
    if (type === "moment" && hidden) {
      queryClient.removeQueries({ queryKey: queryKeys.moments.detailRoot(id) });
    }
    void queryClient.invalidateQueries({ queryKey: queryKeys.moments.all });
  };
}

/** 站务内容处置统一写入口；成功后让公开读路径与审计轨迹立即刷新。 */
export function useAdminContentActions() {
  const refresh = useContentModerationRefresh();
  const hide = useMutation({
    mutationFn: async ({ type, id, reason }: AdminContentActionInput) => {
      const { data, error } = await apiClient.POST("/api/v1/admin/content/{type}/{id}/hide", {
        params: { path: { type, id } },
        body: { reason },
      });
      if (error) throw error;
      return envelope<components["schemas"]["AdminContentModerationResponseDto"]>(data).data;
    },
    onSuccess: (data, variables) => refresh(variables, data.hidden),
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
    onSuccess: (data, variables) => refresh(variables, data.hidden),
  });
  return { hide, restore };
}

/** 前台管理员使用普通 Bearer 登录态隐藏内容，不依赖独立站务会话。 */
export function useAdminBearerContentActions() {
  const refresh = useContentModerationRefresh();
  const hide = useMutation({
    mutationFn: async ({ type, id, reason }: AdminContentActionInput) => {
      const { data, error } = await apiClient.POST("/api/v1/moderation/content/{type}/{id}/hide", {
        params: { path: { type, id } },
        body: { reason },
      });
      if (error) throw error;
      return envelope<components["schemas"]["AdminContentModerationResponseDto"]>(data).data;
    },
    onSuccess: (data, variables) => refresh(variables, data.hidden),
  });
  return { hide };
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
