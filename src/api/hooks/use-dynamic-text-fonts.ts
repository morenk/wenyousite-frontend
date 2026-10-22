"use client";
import { useSyncExternalStore } from "react";
import {
  dynamicFontState,
  dynamicFontProjectionVersion,
  subscribeDynamicFonts,
} from "@/lib/dynamic-text-font-state";
import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/api/query-keys";
import { dynamicFontMetadata } from "@/api/dynamic-font-metadata";
import {
  fontMetadataRetry,
  fontMetadataRetryDelay,
} from "./text-font-recovery";
export function dynamicFontCatalogQueryOptions() {
  return {
    queryKey: queryKeys.dynamicFonts.catalog,
    queryFn: ({ signal }: { signal: AbortSignal }) =>
      dynamicFontMetadata.catalog(signal),
    staleTime: 300000,
    refetchInterval: 300000,
    refetchOnWindowFocus: "always" as const,
    refetchOnMount: "always" as const,
    retry: fontMetadataRetry,
    retryDelay: fontMetadataRetryDelay,
    gcTime: 300000,
  };
}
export function useDynamicTextFonts(enabled: boolean) {
  const query = useQuery({ ...dynamicFontCatalogQueryOptions(), enabled });
  useSyncExternalStore(
    subscribeDynamicFonts,
    dynamicFontProjectionVersion,
    () => 0,
  );
  return {
    ...query,
    data: query.data
      ? {
          ...query.data,
          items: query.data.items.filter(
            (item) => dynamicFontState(item.versionId)?.selectable !== false,
          ),
        }
      : undefined,
  };
}
export function dynamicFontPolicyQueryOptions() {
  return {
    queryKey: queryKeys.dynamicFonts.policy,
    queryFn: ({ signal }: { signal: AbortSignal }) =>
      dynamicFontMetadata.policy(signal),
    staleTime: 300000,
    retry: fontMetadataRetry,
    retryDelay: fontMetadataRetryDelay,
  };
}
