"use client";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/api/client";
import { FontMetadataError, fontMetadataHttpError, fontMetadataRetry, fontMetadataRetryDelay } from "./text-font-recovery";
import { queryKeys } from "@/api/query-keys";
export function textFontCatalogQueryOptions() {
  return {
    queryKey: queryKeys.textFonts,
    queryFn: async ({ signal }: { signal: AbortSignal }) => {
      const { data, error, response } = await apiClient.GET("/api/v1/meta/text-fonts", { signal });
      if (error) throw fontMetadataHttpError(response);
      if (!data) throw new FontMetadataError(false);
      return data.data;
    },
    networkMode: "always" as const, staleTime: 300_000, refetchOnWindowFocus: true, retry: fontMetadataRetry, retryDelay: fontMetadataRetryDelay,
  };
}
export function useTextFontCatalog(enabled = true) { return useQuery({ ...textFontCatalogQueryOptions(), enabled }); }
