"use client";

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/api/client";
import { queryKeys } from "@/api/query-keys";
import type { components, operations } from "@/api/types";

export type AdminMobileRelease = components["schemas"]["AdminMobileReleaseDto"];
export type AdminMobileReleaseFilters = operations["adminMobileReleasesList"]["parameters"]["query"];

export function useAdminMobileReleases(filters: AdminMobileReleaseFilters) {
  return useQuery({
    queryKey: queryKeys.admin.mobileReleases(filters),
    queryFn: async ({ signal }) => {
      const { data, error } = await apiClient.GET("/api/v1/admin/mobile-releases", { params: { query: filters }, signal });
      if (error) throw error;
      return { items: data.data, meta: data.meta };
    },
    placeholderData: keepPreviousData,
    retry: false,
  });
}

export function useAdminMobileRelease(id?: string) {
  return useQuery({
    queryKey: queryKeys.admin.mobileRelease(id),
    queryFn: async ({ signal }) => {
      const { data, error } = await apiClient.GET("/api/v1/admin/mobile-releases/{id}", { params: { path: { id: id! } }, signal });
      if (error) throw error;
      return data.data;
    },
    enabled: Boolean(id),
    retry: false,
  });
}

export function useAdminMobileReleaseActions() {
  const client = useQueryClient();
  const refresh = async (record: AdminMobileRelease) => {
    client.setQueryData(queryKeys.admin.mobileRelease(record.id), record);
    await Promise.all([
      client.invalidateQueries({ queryKey: queryKeys.admin.mobileReleasesRoot }),
      client.invalidateQueries({ queryKey: queryKeys.admin.auditsRoot }),
    ]);
  };
  const create = useMutation({
    mutationFn: async (body: components["schemas"]["CreateMobileReleaseDto"]) => {
      const { data, error } = await apiClient.POST("/api/v1/admin/mobile-releases", { body });
      if (error) throw error;
      return data.data;
    },
    onSuccess: refresh,
  });
  const update = useMutation({
    mutationFn: async ({ id, ...body }: components["schemas"]["UpdateMobileReleaseDto"] & { id: string }) => {
      const { data, error } = await apiClient.PATCH("/api/v1/admin/mobile-releases/{id}", { params: { path: { id } }, body });
      if (error) throw error;
      return data.data;
    },
    onSuccess: refresh,
  });
  const confirm = useMutation({
    mutationFn: async ({ id, revision }: { id: string; revision: number }) => {
      const { data, error } = await apiClient.POST("/api/v1/admin/mobile-releases/{id}/confirm", { params: { path: { id } }, body: { revision } });
      if (error) throw error;
      return data.data;
    },
    onSuccess: refresh,
  });
  return { create, update, confirm };
}
