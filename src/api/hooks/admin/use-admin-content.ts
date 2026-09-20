"use client";

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/api/client";
import { queryKeys } from "@/api/query-keys";
import type { components, operations } from "@/api/types";
import type { AdminContentType } from "@/api/admin-types";
import { envelope } from "./envelope";

export type AdminContent = components["schemas"]["AdminContentResponseDto"];
export type AdminContentDetail = components["schemas"]["AdminContentDetailResponseDto"];
export type AdminContentFilters = NonNullable<operations["adminContentList"]["parameters"]["query"]>;

export function useAdminContent(filters: AdminContentFilters) {
  return useQuery({
    queryKey: queryKeys.admin.content(filters),
    queryFn: async () => {
      const { data, error } = await apiClient.GET("/api/v1/admin/content", { params: { query: filters } });
      if (error) throw error;
      const result = envelope<AdminContent[]>(data);
      return { items: result.data, meta: result.meta };
    },
    placeholderData: keepPreviousData,
  });
}

export function useAdminContentDetail(type: AdminContentType, id: string) {
  return useQuery({
    queryKey: queryKeys.admin.contentDetail(type, id),
    queryFn: async () => {
      const { data, error } = await apiClient.GET("/api/v1/admin/content/{type}/{id}", { params: { path: { type, id } } });
      if (error) throw error;
      return envelope<AdminContentDetail>(data).data;
    },
    retry: false,
  });
}

export function useAdminUserDetail(id: string) {
  return useQuery({
    queryKey: queryKeys.admin.user(id),
    queryFn: async () => {
      const { data, error } = await apiClient.GET("/api/v1/admin/users/{id}", { params: { path: { id } } });
      if (error) throw error;
      return envelope<components["schemas"]["AdminUserDetailResponseDto"]>(data).data;
    },
    retry: false,
  });
}

export function useAdminContentTaxonomy() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...body }: components["schemas"]["UpdateContentTaxonomyDto"] & { id: string }) => {
      const { data, error } = await apiClient.PATCH("/api/v1/admin/content/thread/{id}/taxonomy", { params: { path: { id } }, body });
      if (error) throw error;
      return envelope<AdminContentDetail>(data).data;
    },
    onSuccess: (data) => {
      client.setQueryData(queryKeys.admin.contentDetail("thread", data.id), data);
      return Promise.all([
        client.invalidateQueries({ queryKey: queryKeys.admin.contentRoot }),
        client.invalidateQueries({ queryKey: queryKeys.admin.auditsRoot }),
        client.invalidateQueries({ queryKey: queryKeys.admin.dashboard }),
        client.invalidateQueries({ queryKey: queryKeys.threads.all }),
        client.invalidateQueries({ queryKey: queryKeys.threads.details }),
        client.invalidateQueries({ queryKey: queryKeys.users.all }),
        client.invalidateQueries({ queryKey: queryKeys.search.all }),
        client.invalidateQueries({ queryKey: queryKeys.bookmarks.all }),
        client.invalidateQueries({ queryKey: queryKeys.subscriptions }),
        client.invalidateQueries({ queryKey: queryKeys.invitePreviews }),
        client.invalidateQueries({ queryKey: queryKeys.threadDrafts }),
        client.invalidateQueries({ queryKey: queryKeys.draftState }),
        client.invalidateQueries({ queryKey: queryKeys.topicTagsRoot }),
      ]);
    },
  });
}
