"use client";

import { useState } from "react";
import { parseAsString, parseAsStringLiteral, useQueryStates } from "nuqs";
import { getApiError } from "@/api/errors";
import { useAdminFontManagement } from "@/api/hooks/admin/use-admin-font-management";
import { useCursorPagination } from "@/hooks/use-cursor-pagination";
import { TextFontListView } from "./text-font-list-view";
import { TextFontOrderPanel } from "./text-font-order-panel";

const parsers = {
  search: parseAsString.withDefault(""),
  language: parseAsStringLiteral(["all", "zh", "ja", "en", "other"]).withDefault("all"),
  status: parseAsStringLiteral(["all", "draft", "enabled", "disabled", "withdrawn"]).withDefault("all"),
  sort: parseAsStringLiteral(["created", "updated", "name", "display"]).withDefault("created"),
  direction: parseAsStringLiteral(["asc", "desc"]).withDefault("desc"),
};
export function TextFontsPanel() {
  const [ordering, setOrdering] = useState(false);
  return ordering ? <TextFontOrderPanel onClose={() => setOrdering(false)} /> : <TextFontManagementList onReorder={() => setOrdering(true)} />;
}
function TextFontManagementList({ onReorder }: { onReorder: () => void }) {
  const [filters, setFilters] = useQueryStates(parsers, { shallow: true });
  const [reset, setReset] = useState(0);
  const pagination = useCursorPagination(JSON.stringify([filters, reset]));
  const query = useAdminFontManagement({
    q: filters.search || undefined,
    language: filters.language === "all" ? undefined : filters.language,
    status: filters.status === "all" ? undefined : filters.status,
    sort: ({ created: "createdAt", updated: "updatedAt", name: "name", display: "sortOrder" } as const)[filters.sort],
    direction: filters.direction, cursor: pagination.cursor,
  });
  if (pagination.cursor && query.isError && getApiError(query.error).code === 40931) setReset(reset + 1);
  return <TextFontListView filters={filters} onFiltersChange={(value) => void setFilters(value)}
    rows={(query.data?.items ?? []).map((item) => ({ id: item.familyId, name: item.name, language: item.language, status: item.status, processing: item.latestJob?.status, submissionId: item.latestSubmissionId ?? undefined, currentVersion: item.currentVersionId?.slice(-8) }))}
    page={pagination.page} hasNext={Boolean(query.data?.nextCursor)} loading={query.isLoading} error={query.isError} busy={query.isFetching}
    onRetry={() => void query.refetch()} onReorder={onReorder}
    onPageChange={(page) => { if (page < pagination.page) pagination.previous(); else if (query.data?.nextCursor) pagination.next(query.data.nextCursor); }} />;
}
