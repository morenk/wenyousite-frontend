"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { WenyouTime } from "@/components/shared/wenyou-time";
import {
  AdminTable, AdminTableActionCell, AdminTableActionHeader, AdminTableBody,
  AdminTableCell, AdminTableEmpty, AdminTableHead, AdminTableHeader, AdminTableRow,
} from "./admin-table";

/** 仅用于展示，由页面从服务端返回事实映射，不作为接口类型。 */
export type MobileReleaseTableRow = {
  id: string;
  platform: string;
  version: string;
  build: number;
  state: "草稿" | "待发布" | "已发布";
  pendingRevision: boolean;
  summary: string;
  updatedAt: string;
};

export function MobileReleasesTable({
  rows,
  loading,
  failed,
  busy,
  onRetry,
  onOpen,
}: {
  rows: readonly MobileReleaseTableRow[];
  loading: boolean;
  failed: boolean;
  busy: boolean;
  onRetry: () => void;
  onOpen: (id: string) => void;
}) {
  return (
    <AdminTable aria-label="移动端版本列表" aria-busy={busy} className="min-w-[56rem]">
      <AdminTableHead>
        <tr>
          <AdminTableHeader>平台</AdminTableHeader>
          <AdminTableHeader>版本 / 构建号</AdminTableHeader>
          <AdminTableHeader>状态</AdminTableHeader>
          <AdminTableHeader>更新摘要</AdminTableHeader>
          <AdminTableHeader>最近修改</AdminTableHeader>
          <AdminTableActionHeader>操作</AdminTableActionHeader>
        </tr>
      </AdminTableHead>
      <AdminTableBody>
        {loading ? <AdminTableEmpty colSpan={6}><span role="status">正在读取移动端版本…</span></AdminTableEmpty> : failed ? (
          <AdminTableEmpty colSpan={6}>
            <span role="alert" className="text-destructive">移动端版本加载失败</span>
            <Button type="button" size="compact" variant="ghost" className="ml-2" disabled={busy} onClick={onRetry}>重试</Button>
          </AdminTableEmpty>
        ) : rows.length === 0 ? (
          <AdminTableEmpty colSpan={6}>当前筛选下没有移动端版本</AdminTableEmpty>
        ) : rows.map((row) => (
          <AdminTableRow key={row.id}>
            <AdminTableCell className="whitespace-nowrap">{row.platform}</AdminTableCell>
            <AdminTableCell>
              <p className="font-utility font-semibold">{row.version}</p>
              <p className="font-utility text-xs text-muted-foreground">构建 {row.build}</p>
            </AdminTableCell>
            <AdminTableCell>
              <div className="flex flex-wrap gap-1">
                <Badge tone={row.state === "已发布" ? "success" : row.state === "待发布" ? "info" : "neutral"}>{row.state}</Badge>
                {row.pendingRevision ? <Badge tone="warning">待修订确认</Badge> : null}
              </div>
            </AdminTableCell>
            <AdminTableCell className="max-w-80"><p className="line-clamp-2 break-words">{row.summary}</p></AdminTableCell>
            <AdminTableCell className="whitespace-nowrap text-xs text-muted-foreground"><WenyouTime mode="exact" value={row.updatedAt} /></AdminTableCell>
            <AdminTableActionCell>
              <Button type="button" size="compact" variant="ghost" disabled={busy} onClick={() => onOpen(row.id)}>查看</Button>
            </AdminTableActionCell>
          </AdminTableRow>
        ))}
      </AdminTableBody>
    </AdminTable>
  );
}
