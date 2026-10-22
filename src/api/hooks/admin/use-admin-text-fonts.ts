"use client";
import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { adminTextFontData } from "./admin-text-font-response";
import { apiClient } from "@/api/client";
import { queryKeys } from "@/api/query-keys";
import type { components } from "@/api/types";
export type AdminFontFamily = components["schemas"]["FontAdminFamilyDetailDto"];
export type FontConfiguration = components["schemas"]["FontConfigurationDto"];
export function useAdminTextFonts(after?: string) {
  return useQuery({
    queryKey: queryKeys.admin.textFonts(after),
    queryFn: async ({ signal }) => {
      return adminTextFontData(apiClient.GET("/api/v1/admin/text-fonts", {
        params: { query: { limit: 20, ...(after ? { after } : {}) } },
        signal,
      }));
    },
    placeholderData: keepPreviousData,
    retry: false,
  });
}
export function useAdminTextFont(id?: string) {
  return useQuery({
    queryKey: queryKeys.admin.textFont(id),
    enabled: Boolean(id),
    queryFn: async ({ signal }) => {
      return adminTextFontData(apiClient.GET(
        "/api/v1/admin/text-fonts/{familyId}",
        { params: { path: { familyId: id! } }, signal },
      ));
    },
    retry: false,
    refetchInterval: (query) =>
      query.state.data?.jobs.some(
        (job) => job.status === "queued" || job.status === "processing",
      )
        ? 3000
        : false,
  });
}
export function useAdminTextFontPreview(id?: string) {
  return useQuery({
    queryKey: queryKeys.admin.textFontPreview(id),
    enabled: Boolean(id),
    queryFn: async ({ signal }) => {
      return adminTextFontData(apiClient.GET(
        "/api/v1/admin/text-fonts/versions/{versionId}/preview",
        { params: { path: { versionId: id! } }, signal },
      ));
    },
    retry: false,
    gcTime: 60000,
  });
}
export function useAdminTextFontActions() {
  const client = useQueryClient();
  const refresh = async () => {
    await Promise.all([
      client.invalidateQueries({ queryKey: queryKeys.admin.textFontsRoot }),
      client.invalidateQueries({ queryKey: queryKeys.admin.auditsRoot }),
      client.invalidateQueries({ queryKey: queryKeys.dynamicFonts.catalog }),
    ]);
  };
  const create = useMutation({
    mutationFn: async (body: FontConfiguration) => {
      return adminTextFontData(apiClient.POST("/api/v1/admin/text-fonts", {
        body,
      }));
    },
    onSuccess: refresh,
  });
  const update = useMutation({
    mutationFn: async ({
      familyId,
      ...body
    }: components["schemas"]["UpdateFontConfigurationDto"] & {
      familyId: string;
    }) => {
      return adminTextFontData(apiClient.PATCH(
        "/api/v1/admin/text-fonts/{familyId}",
        { params: { path: { familyId } }, body },
      ));
    },
    onSuccess: refresh,
  });
  const upload = useMutation({
    mutationFn: async ({
      familyId,
      file,
      format,
      expectedFamilyRevision,
    }: {
      familyId: string;
      file: File;
      format: "ttf" | "otf";
      expectedFamilyRevision: number;
    }) => {
      return adminTextFontData(apiClient.POST(
        "/api/v1/admin/text-fonts/{familyId}/sources",
        {
          params: {
            path: { familyId },
            query: { format, expectedFamilyRevision },
          },
          headers: { "Content-Type": "application/octet-stream" },
          body: "",
          bodySerializer: () => file,
        },
      ));
    },
    onSuccess: refresh,
  });
  const process = useMutation({
    mutationFn: async (jobId: string) => {
      return adminTextFontData(apiClient.POST(
        "/api/v1/admin/text-fonts/jobs/{jobId}/process",
        { params: { path: { jobId } } },
      ));
    },
    onSuccess: refresh,
  });
  const publish = useMutation({
    mutationFn: async ({
      familyId,
      ...body
    }: components["schemas"]["FontPublishDto"] & { familyId: string }) => {
      return adminTextFontData(apiClient.POST(
        "/api/v1/admin/text-fonts/{familyId}/publish",
        { params: { path: { familyId } }, body },
      ));
    },
    onSuccess: refresh,
  });
  const enabled = useMutation({
    mutationFn: async ({
      familyId,
      ...body
    }: components["schemas"]["FontEnabledDto"] & { familyId: string }) => {
      return adminTextFontData(apiClient.PATCH(
        "/api/v1/admin/text-fonts/{familyId}/enabled",
        { params: { path: { familyId } }, body },
      ));
    },
    onSuccess: refresh,
  });
  const withdraw = useMutation({
    mutationFn: async ({
      versionId,
      ...body
    }: components["schemas"]["FontWithdrawDto"] & { versionId: string }) => {
      return adminTextFontData(apiClient.POST(
        "/api/v1/admin/text-fonts/versions/{versionId}/withdraw",
        { params: { path: { versionId } }, body },
      ));
    },
    onSuccess: refresh,
  });
  return { create, update, upload, process, publish, enabled, withdraw };
}
