"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { getApiError } from "@/api/errors";
import { useAdminMobileReleases, useAdminSession } from "@/api/hooks/use-admin";
import { Button } from "@/components/ui/button";
import { useCursorPagination } from "@/hooks/use-cursor-pagination";
import { AdminPagination } from "./admin-list-controls";
import { MobileReleaseDialog, mobileReleaseStatusLabels } from "./mobile-release-dialog";
import { MobileReleasesTable } from "./mobile-releases-table";

export function MobileReleasesPanel() {
  const session = useAdminSession();
  const [selected, setSelected] = useState<string>();
  const [firstPage, setFirstPage] = useState(0);
  const pagination = useCursorPagination(`android:${firstPage}`);
  const releases = useAdminMobileReleases({ platform: "android", limit: 20, cursor: pagination.cursor });
  const authenticated = session.sessionStatus === "authenticated";
  const invalidCursor = getApiError(releases.error).code === 40007;
  return <div data-slot="admin-mobile-releases-workspace" data-layout="full-table" className="w-full">
    <section className="overflow-hidden rounded-[var(--radius-card)] border border-border bg-card">
      <div className="flex items-center justify-between gap-3 border-b border-border px-3 py-2">
        <span className="text-sm text-muted-foreground">Android</span>
        <Button type="button" size="compact" disabled={!authenticated} onClick={() => setSelected("new")}><Plus />新建版本说明</Button>
      </div>
      <MobileReleasesTable
        rows={(releases.data?.items ?? []).map((row) => ({ id: row.id, platform: "Android", version: row.versionName, build: row.buildNumber, state: mobileReleaseStatusLabels[row.status], pendingRevision: Boolean(row.confirmed && row.hasUnconfirmedChanges), summary: row.summary, updatedAt: row.updatedAt }))}
        loading={releases.isLoading} failed={releases.isError} busy={releases.isFetching || !authenticated}
        onRetry={() => { if (invalidCursor) setFirstPage((value) => value + 1); else void releases.refetch(); }}
        onOpen={setSelected}
      />
      {invalidCursor ? <p role="alert" className="px-3 py-2 text-sm text-destructive">分页已失效，重试将返回第一页。</p> : null}
      <AdminPagination page={pagination.page} pageSize={20} visibleCount={releases.isError ? 0 : releases.data?.items.length ?? 0}
        hasPrevious={pagination.hasPrevious} hasNext={!releases.isError && Boolean(releases.data?.meta.hasMore && releases.data.meta.cursor)}
        onPrevious={pagination.previous} onNext={() => { if (releases.data?.meta.cursor) pagination.next(releases.data.meta.cursor); }} busy={releases.isFetching || !authenticated} />
    </section>
    {selected ? <MobileReleaseDialog key={selected} id={selected === "new" ? undefined : selected} onClose={() => setSelected(undefined)} onCreated={(id) => { setFirstPage((value) => value + 1); setSelected(id); }} /> : null}
  </div>;
}
