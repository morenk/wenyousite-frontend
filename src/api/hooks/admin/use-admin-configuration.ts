"use client";

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/api/client";
import { queryKeys } from "@/api/query-keys";
import type { components, operations } from "@/api/types";
import type { NotificationCampaign } from "@/api/admin-types";
import { envelope } from "@/api/hooks/admin/envelope";

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
