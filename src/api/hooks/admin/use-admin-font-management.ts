"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/api/client";
import { queryKeys } from "@/api/query-keys";
import type { components, operations } from "@/api/types";
import { adminTextFontData } from "./admin-text-font-response";

export type FontManagementQuery = NonNullable<operations["adminTextFontsManagement"]["parameters"]["query"]>;
export type FontManagementItem = components["schemas"]["FontManagementItemDto"];
export type FontOrderSnapshot = Pick<components["schemas"]["FontManagementPageDto"], "items" | "catalogRevision" | "listingRevision">;
export const readFontManagement = (query: FontManagementQuery, signal?: AbortSignal) =>
  adminTextFontData(apiClient.GET("/api/v1/admin/text-fonts/management", { params: { query }, signal }));

export function useAdminFontManagement(query: FontManagementQuery) {
  return useQuery({ queryKey: queryKeys.admin.fontManagement(query), queryFn: ({ signal }) => readFontManagement(query, signal), retry: false });
}

/** 排序只使用完整、同修订的可选集合；不复用列表筛选或分页缓存。 */
export async function readFontOrder(signal?: AbortSignal): Promise<FontOrderSnapshot> {
  const first = await readFontManagement({ status: "enabled", sort: "sortOrder", direction: "asc" }, signal);
  const items = [...first.items];
  let cursor = first.nextCursor;
  const seen = new Set<string>();
  while (cursor) {
    if (seen.has(cursor)) throw new Error("字体分页重复，请重新读取完整顺序");
    seen.add(cursor);
    const page = await readFontManagement({ status: "enabled", sort: "sortOrder", direction: "asc", cursor }, signal);
    if (page.catalogRevision !== first.catalogRevision || page.listingRevision !== first.listingRevision || page.total !== first.total)
      throw new Error("字体目录已变化，请重新读取完整顺序");
    items.push(...page.items); cursor = page.nextCursor;
  }
  if (items.length !== first.total || new Set(items.map((item) => item.familyId)).size !== items.length
    || items.some((item) => item.status !== "enabled" || !item.currentVersionId))
    throw new Error("字体集合不完整，请重新读取完整顺序");
  return { items, catalogRevision: first.catalogRevision, listingRevision: first.listingRevision };
}
export function fontOrderRequest(snapshot: FontOrderSnapshot, ids: readonly string[]): components["schemas"]["ReorderFontsDto"] {
  const byId = new Map(snapshot.items.map((item) => [item.familyId, item]));
  if (ids.length !== byId.size || new Set(ids).size !== ids.length || ids.some((id) => !byId.has(id)))
    throw new Error("字体集合不完整，请重新读取完整顺序");
  const groups: components["schemas"]["FontOrderGroupDto"][] = [];
  for (const language of ["zh", "ja", "en", "other"] as const) {
    const before = snapshot.items.filter((item) => item.language === language).map((item) => item.familyId);
    const after = ids.filter((id) => byId.get(id)!.language === language);
    if (before.some((id, index) => id !== after[index])) groups.push({ language, items: after.map((familyId) => ({ familyId, expectedFamilyRevision: byId.get(familyId)!.revision })) });
  }
  return { expectedCatalogRevision: snapshot.catalogRevision, groups };
}
export function useAdminFontOrder() {
  return useQuery({ queryKey: queryKeys.admin.fontOrder, queryFn: ({ signal }) => readFontOrder(signal), retry: false, staleTime: 0, refetchOnMount: "always", refetchOnWindowFocus: false });
}
export function useSaveAdminFontOrder() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (body: components["schemas"]["ReorderFontsDto"]) => adminTextFontData(apiClient.PUT("/api/v1/admin/text-fonts/order", { body })),
    retry: false,
    onSuccess: async () => { await Promise.all([
      client.invalidateQueries({ queryKey: queryKeys.admin.textFontsRoot }),
      client.invalidateQueries({ queryKey: queryKeys.admin.auditsRoot }),
      client.invalidateQueries({ queryKey: queryKeys.dynamicFonts.catalog }),
    ]); },
  });
}
