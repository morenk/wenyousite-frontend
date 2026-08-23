"use client";

import { Download, ScrollText } from "lucide-react";
import { useQueryStates } from "nuqs";
import {
  type AdminAuditFilters,
  useAdminAuditLogs,
} from "@/api/hooks/use-admin";
import { AdminFilterBar, AdminFilterField, AdminPagination } from "./admin-list-controls";
import {
  AdminTable,
  AdminTableBody,
  AdminTableCell,
  AdminTableEmpty,
  AdminTableHead,
  AdminTableHeader,
  AdminTableRow,
} from "./admin-table";
import { useCursorPagination } from "./use-cursor-pagination";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { WenyouTime } from "@/components/shared/wenyou-time";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { adminAuditFilterParsers, adminAuditUrlKeys } from "@/lib/admin-url-state";

const actionLabels = {
  SUPER_ADMIN_BOOTSTRAPPED: "初始化超级管理员",
  ADMIN_ROLE_GRANTED: "授予站务角色",
  ADMIN_ROLE_REVOKED: "撤销站务角色",
  USER_SUSPENDED: "暂停账号",
  USER_BANNED: "封禁账号",
  USER_SANCTION_REVOKED: "解除处罚",
  CONTENT_HIDDEN: "隐藏内容",
  CONTENT_RESTORED: "恢复内容",
  REPORT_RESOLVED: "举报处置",
  REPORT_DISMISSED: "举报驳回",
  SYSTEM_NOTIFICATION_SENT: "发送系统通知",
  THREAD_CATEGORY_CREATED: "新增主题分类",
  THREAD_CATEGORY_UPDATED: "更新主题分类",
  TAG_CREATED: "新增平台标签",
  TAG_UPDATED: "更新平台标签",
  ADMIN_INVITED: "邀请站务",
  ADMIN_INVITE_ACCEPTED: "接受站务邀请",
  ADMIN_INVITE_CANCELED: "取消站务邀请",
  SUPER_ADMIN_TRANSFERRED: "移交超级管理员",
  ADMIN_SESSION_REVOKED: "注销站务会话",
  CASE_RESOLVED: "案件处置",
  CASE_DISMISSED: "案件驳回",
  APPEAL_SUBMITTED: "用户申诉",
  APPEAL_UPHELD: "维持决定",
  APPEAL_OVERTURNED: "推翻决定",
  USER_SESSIONS_REVOKED: "注销用户会话",
  PASSWORD_RESET_REQUESTED_BY_ADMIN: "管理员发起重置密码",
  NOTIFICATION_CAMPAIGN_SCHEDULED: "创建通知计划",
  NOTIFICATION_CAMPAIGN_CANCELED: "取消通知计划",
  THREAD_CATEGORY_MERGED: "合并主题分类",
  TAG_MERGED: "合并平台标签",
  SITE_SETTINGS_UPDATED: "更新运行设置",
} satisfies Record<NonNullable<AdminAuditFilters["action"]>, string>;

const targetLabels = {
  USER: "用户",
  THREAD: "主题帖",
  POST: "帖子",
  MOMENT: "动态",
  MOMENT_COMMENT: "动态评论",
  REPORT: "举报",
  SYSTEM_NOTIFICATION: "系统通知",
  THREAD_CATEGORY: "主题分类",
  TAG: "平台标签",
  MODERATION_CASE: "治理案件",
  MODERATION_DECISION: "治理决定",
  MODERATION_APPEAL: "申诉",
  ADMIN_INVITE: "站务邀请",
  ADMIN_SESSION: "站务会话",
  NOTIFICATION_CAMPAIGN: "通知计划",
  SITE_SETTINGS: "运行设置",
} satisfies Record<NonNullable<AdminAuditFilters["targetType"]>, string>;

function beijingDay(value: string, end = false) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
  const date = new Date(`${value}T${end ? "23:59:59.999" : "00:00:00"}+08:00`);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

export function AuditPanel() {
  const [{ action, targetType, targetId, dateFrom, dateTo }, setFilters] = useQueryStates(adminAuditFilterParsers, {
    shallow: true,
    urlKeys: adminAuditUrlKeys,
  });
  const scope = `${action ?? "ALL"}:${targetType ?? "ALL"}:${targetId.trim()}:${dateFrom}:${dateTo}`;
  const pagination = useCursorPagination(scope);
  const requestFilters: AdminAuditFilters = {
    action: action ?? undefined,
    targetType: targetType ?? undefined,
    targetId: targetId.trim() || undefined,
    createdAfter: beijingDay(dateFrom),
    createdBefore: beijingDay(dateTo, true),
  };
  const logs = useAdminAuditLogs({ ...requestFilters, cursor: pagination.cursor, limit: 20 });
  const exportParams = new URLSearchParams();
  for (const [key, value] of Object.entries(requestFilters)) {
    if (value) exportParams.set(key, String(value));
  }
  const exportQuery = exportParams.toString();
  const exportHref = `/api/v1/admin/audit-logs/export${exportQuery ? `?${exportQuery}` : ""}`;
  const activeCount = (action ? 1 : 0)
    + (targetType ? 1 : 0)
    + (targetId.trim() ? 1 : 0)
    + (dateFrom ? 1 : 0)
    + (dateTo ? 1 : 0);

  return (
    <section className="overflow-hidden rounded-lg border border-border bg-card">
      <div className="flex items-center justify-between gap-4 border-b border-border px-6 py-5">
        <div className="flex items-center gap-3">
          <span className="flex size-10 items-center justify-center rounded-xl bg-accent text-accent-foreground"><ScrollText className="size-5" /></span>
          <div>
            <h2 className="font-display text-lg font-medium">不可变决定轨迹</h2>
            <p className="text-xs text-muted-foreground">业务记录永久保留；表格筛选与导出使用同一查询范围。</p>
          </div>
        </div>
        <a className={buttonVariants({ variant: "outline", size: "compact" })} href={exportHref}><Download />导出当前结果</a>
      </div>
      <AdminFilterBar
        activeCount={activeCount}
        onReset={() => void setFilters(null, { history: "push" })}
        summary={logs.data ? `当前页 ${logs.data.items.length} 条` : undefined}
      >
        <AdminFilterField label="动作" className="w-48">
          <Select value={action ?? "ALL"} onValueChange={(value) => void setFilters({ action: value === "ALL" ? null : value as NonNullable<AdminAuditFilters["action"]> }, { history: "push" })}>
            <SelectTrigger className="w-full"><SelectValue>{!action ? "全部动作" : actionLabels[action]}</SelectValue></SelectTrigger>
            <SelectContent align="start">
              <SelectItem value="ALL">全部动作</SelectItem>
              {Object.entries(actionLabels).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}
            </SelectContent>
          </Select>
        </AdminFilterField>
        <AdminFilterField label="目标类型" className="w-40">
          <Select value={targetType ?? "ALL"} onValueChange={(value) => void setFilters({ targetType: value === "ALL" ? null : value as NonNullable<AdminAuditFilters["targetType"]> }, { history: "push" })}>
            <SelectTrigger className="w-full"><SelectValue>{!targetType ? "全部目标" : targetLabels[targetType]}</SelectValue></SelectTrigger>
            <SelectContent align="start">
              <SelectItem value="ALL">全部目标</SelectItem>
              {Object.entries(targetLabels).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}
            </SelectContent>
          </Select>
        </AdminFilterField>
        <AdminFilterField label="目标编号" className="w-44">
          <Input value={targetId} onChange={(event) => void setFilters({ targetId: event.target.value })} placeholder="精确匹配" />
        </AdminFilterField>
        <AdminFilterField label="起始日期（北京时间）" className="w-40">
          <Input type="date" value={dateFrom} onChange={(event) => void setFilters({ dateFrom: event.target.value }, { history: "push" })} />
        </AdminFilterField>
        <AdminFilterField label="截止日期（北京时间）" className="w-40">
          <Input type="date" value={dateTo} onChange={(event) => void setFilters({ dateTo: event.target.value }, { history: "push" })} />
        </AdminFilterField>
      </AdminFilterBar>
      <AdminTable aria-label="决定轨迹" className="min-w-[56rem]">
        <AdminTableHead>
          <tr>
            <AdminTableHeader>发生时间</AdminTableHeader>
            <AdminTableHeader>动作</AdminTableHeader>
            <AdminTableHeader>业务目标</AdminTableHeader>
            <AdminTableHeader>操作理由</AdminTableHeader>
            <AdminTableHeader className="text-right">操作人</AdminTableHeader>
          </tr>
        </AdminTableHead>
        <AdminTableBody>
        {logs.isLoading ? <AdminTableEmpty colSpan={5}>正在读取决定轨迹…</AdminTableEmpty> : null}
        {logs.isError ? <AdminTableEmpty colSpan={5}><span className="text-destructive">决定轨迹加载失败</span></AdminTableEmpty> : null}
        {logs.data?.items.map((log) => (
          <AdminTableRow key={log.id}>
            <AdminTableCell className="text-xs whitespace-nowrap text-muted-foreground"><WenyouTime value={log.createdAt} /></AdminTableCell>
            <AdminTableCell><Badge tone="neutral">{actionLabels[log.action]}</Badge></AdminTableCell>
            <AdminTableCell>
              <p className="font-semibold">{targetLabels[log.targetType]}</p>
              <p className="mt-0.5 max-w-64 truncate font-mono text-[0.6875rem] text-muted-foreground" title={log.targetId ?? undefined}>{log.targetId || "—"}</p>
            </AdminTableCell>
            <AdminTableCell className="max-w-md text-sm leading-6">{log.reason || <span className="text-muted-foreground">未填写</span>}</AdminTableCell>
            <AdminTableCell className="text-right font-bold whitespace-nowrap">{log.actor?.username ?? "系统"}</AdminTableCell>
          </AdminTableRow>
        ))}
        {!logs.isLoading && !logs.isError && logs.data?.items.length === 0 ? <AdminTableEmpty colSpan={5}>当前筛选下没有审计记录</AdminTableEmpty> : null}
        </AdminTableBody>
      </AdminTable>
      <AdminPagination
        page={pagination.page}
        pageSize={20}
        visibleCount={logs.data?.items.length ?? 0}
        hasPrevious={pagination.hasPrevious}
        hasNext={Boolean(logs.data?.meta?.hasMore && logs.data.meta.cursor)}
        onPrevious={pagination.previous}
        onNext={() => {
          if (logs.data?.meta?.cursor) pagination.next(logs.data.meta.cursor);
        }}
        busy={logs.isFetching}
      />
    </section>
  );
}
