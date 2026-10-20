"use client";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/api/client";
import { queryKeys } from "@/api/query-keys";
export function textFontCatalogQueryOptions() {
  return {
    queryKey: queryKeys.textFonts,
    queryFn: async () => {
      const { data, error } = await apiClient.GET("/api/v1/meta/text-fonts");
      if (error) throw error;
      if (!data) throw new Error("字体列表加载失败");
      return data.data;
    },
    staleTime: 300_000, retry: 1,
  };
}
export function useTextFontCatalog(enabled = true) { return useQuery({ ...textFontCatalogQueryOptions(), enabled }); }
