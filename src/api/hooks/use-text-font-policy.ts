"use client";
import { apiClient } from "@/api/client";
import { queryKeys } from "@/api/query-keys";
import { FontMetadataError, fontMetadataHttpError, fontMetadataRetry, fontMetadataRetryDelay } from "./text-font-recovery";
export function textFontPolicyQueryOptions() {
  return {
    queryKey: queryKeys.textFontPolicy,
    queryFn: async ({ signal }: { signal: AbortSignal }) => {
      const { data, error, response } = await apiClient.GET("/api/v1/meta/text-fonts/runtime-policy", { signal });
      if (response.status === 404) return null;
      if (error) throw fontMetadataHttpError(response);
      if (!data) throw new FontMetadataError(false);
      return data.data;
    },
    networkMode: "always" as const, staleTime: 300_000, refetchOnWindowFocus: true, retry: fontMetadataRetry, retryDelay: fontMetadataRetryDelay,
  };
}
