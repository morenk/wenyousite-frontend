"use client";

import { Gavel } from "lucide-react";
import { useQueryStates } from "nuqs";
import { useState } from "react";
import { toast } from "sonner";
import type { DecisionAction, TargetType } from "@/api/admin-types";
import { getApiErrorMessage } from "@/api/errors";
import { useAdminAppeals, useResolveAdminAppeal } from "@/api/hooks/use-admin";
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
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { WenyouTime } from "@/components/shared/wenyou-time";
import { adminAppealFilterParsers, adminAppealUrlKeys } from "@/lib/admin-url-state";
import { HighRiskGate } from "./high-risk-gate";

type AppealStatus = "PENDING" | "UPHELD" | "OVERTURNED";

const statusLabels: Record<AppealStatus, string> = {
  PENDING: "待复核",
  UPHELD: "已维持",
  OVERTURNED: "已推翻",
};

const targetLabels: Record<TargetType, string> = {
  USER: "用户",
  THREAD: "主题帖",
  POST: "帖子",
  MOMENT: "动态",
  MOMENT_COMMENT: "动态评论",
  DIRECT_MESSAGE: "私聊消息",
};

const actionLabels: Record<DecisionAction, string> = {
  HIDE_CONTENT: "隐藏内容",
  SUSPEND_USER: "暂停账号",
  BAN_USER: "永久封禁",
};

function statusTone(status: AppealStatus) {
  if (status === "PENDING") return "warning" as const;
  if (status === "OVERTURNED") return "info" as const;
  return "success" as const;
}

export function AppealsPanel() {
  const [{ status, targetType, action }, setFilters] = useQueryStates(adminAppealFilterParsers, {
    shallow: true,
    urlKeys: adminAppealUrlKeys,
  });
  const pagination = useCursorPagination(`${status}:${targetType ?? "ALL"}:${action ?? "ALL"}`);
  const appeals = useAdminAppeals({
    status: status === "ALL" ? undefined : status,
    targetType: targetType ?? undefined,
    action: action ?? undefined,
    cursor: pagination.cursor,
    limit: 20,
  });
  const resolve = useResolveAdminAppeal();
  const [selectedId, setSelectedId] = useState<string>();
  const [note, setNote] = useState("");

  const effectiveSelectedId = appeals.data?.items.some((appeal) => appeal.id === selectedId)
    ? selectedId
    : appeals.data?.items[0]?.id;
  const selected = appeals.data?.items.find((appeal) => appeal.id === effectiveSelectedId);
  const activeCount = (status === "PENDING" ? 0 : 1) + (targetType ? 1 : 0) + (action ? 1 : 0);

  return (
    <div className="grid min-h-[42rem] grid-cols-[34rem_minmax(0,1fr)] overflow-hidden rounded-lg border border-border bg-card">
      <section className="flex min-h-0 flex-col border-r border-border">
        <div className="border-b border-border px-5 py-4">
          <h2 className="font-display text-lg font-medium">申诉台账</h2>
          <p className="mt-1 text-xs text-muted-foreground">推翻决定将自动恢复原处置。</p>
        </div>
        <AdminFilterBar
          activeCount={activeCount}
          onReset={() => void setFilters(null, { history: "push" })}
          className="px-4"
        >
          <AdminFilterField label="状态" className="w-32">
            <Select value={status} onValueChange={(value) => void setFilters({ status: value as AppealStatus | "ALL" }, { history: "push" })}>
              <SelectTrigger className="w-full"><SelectValue>{status === "ALL" ? "全部状态" : statusLabels[status]}</SelectValue></SelectTrigger>
              <SelectContent align="start">
                <SelectItem value="ALL">全部状态</SelectItem>
                {Object.entries(statusLabels).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}
              </SelectContent>
            </Select>
          </AdminFilterField>
          <AdminFilterField label="目标" className="w-32">
            <Select value={targetType ?? "ALL"} onValueChange={(value) => void setFilters({ targetType: value === "ALL" ? null : value as TargetType }, { history: "push" })}>
              <SelectTrigger className="w-full"><SelectValue>{!targetType ? "全部目标" : targetLabels[targetType]}</SelectValue></SelectTrigger>
              <SelectContent align="start">
                <SelectItem value="ALL">全部目标</SelectItem>
                {Object.entries(targetLabels).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}
              </SelectContent>
            </Select>
          </AdminFilterField>
          <AdminFilterField label="原处置" className="w-32">
            <Select value={action ?? "ALL"} onValueChange={(value) => void setFilters({ action: value === "ALL" ? null : value as DecisionAction }, { history: "push" })}>
              <SelectTrigger className="w-full"><SelectValue>{!action ? "全部处置" : actionLabels[action]}</SelectValue></SelectTrigger>
              <SelectContent align="start">
                <SelectItem value="ALL">全部处置</SelectItem>
                {Object.entries(actionLabels).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}
              </SelectContent>
            </Select>
          </AdminFilterField>
        </AdminFilterBar>
        <div className="min-h-0 flex-1 overflow-y-auto">
          <AdminTable aria-label="申诉台账">
            <AdminTableHead className="sticky top-0 z-10">
              <tr>
                <AdminTableHeader>状态</AdminTableHeader>
                <AdminTableHeader>申诉用户与陈述</AdminTableHeader>
                <AdminTableHeader>原处置</AdminTableHeader>
                <AdminTableHeader>提交时间</AdminTableHeader>
                <AdminTableHeader className="text-right">操作</AdminTableHeader>
              </tr>
            </AdminTableHead>
            <AdminTableBody>
          {appeals.isLoading ? <AdminTableEmpty colSpan={5}>正在读取申诉…</AdminTableEmpty> : null}
          {appeals.isError ? <AdminTableEmpty colSpan={5}><span className="text-destructive">申诉列表加载失败</span></AdminTableEmpty> : null}
          {appeals.data?.items.map((appeal) => (
            <AdminTableRow key={appeal.id} data-selected={effectiveSelectedId === appeal.id}>
              <AdminTableCell><Badge tone={statusTone(appeal.status)}>{statusLabels[appeal.status]}</Badge></AdminTableCell>
              <AdminTableCell className="max-w-56">
                <p className="font-bold">{appeal.appellant.username}</p>
                <p className="mt-0.5 line-clamp-2 text-xs leading-5 text-muted-foreground">{appeal.statement}</p>
              </AdminTableCell>
              <AdminTableCell className="whitespace-nowrap">
                <p className="font-semibold">{actionLabels[appeal.decision.action]}</p>
                <p className="text-xs text-muted-foreground">{targetLabels[appeal.decision.targetType]}</p>
              </AdminTableCell>
              <AdminTableCell className="text-xs whitespace-nowrap text-muted-foreground"><WenyouTime value={appeal.createdAt} /></AdminTableCell>
              <AdminTableCell className="text-right">
                <Button type="button" size="compact" variant={effectiveSelectedId === appeal.id ? "secondary" : "ghost"} onClick={() => { setSelectedId(appeal.id); setNote(""); }}>
                  {effectiveSelectedId === appeal.id ? "已选择" : "查看"}
                </Button>
              </AdminTableCell>
            </AdminTableRow>
          ))}
          {!appeals.isLoading && appeals.data?.items.length === 0 ? (
            <AdminTableEmpty colSpan={5}>当前筛选下没有申诉</AdminTableEmpty>
          ) : null}
            </AdminTableBody>
          </AdminTable>
        </div>
        <AdminPagination
          page={pagination.page}
          pageSize={20}
          visibleCount={appeals.data?.items.length ?? 0}
          hasPrevious={pagination.hasPrevious}
          hasNext={Boolean(appeals.data?.meta?.hasMore && appeals.data.meta.cursor)}
          onPrevious={pagination.previous}
          onNext={() => {
            if (appeals.data?.meta?.cursor) pagination.next(appeals.data.meta.cursor);
          }}
          busy={appeals.isFetching}
          className="px-4"
        />
      </section>

      <section className="min-w-0 p-7">
        {!selected ? (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">选择一份申诉查看</div>
        ) : (
          <div className="mx-auto max-w-3xl">
            <div className="flex items-center gap-3">
              <span className="flex size-11 items-center justify-center rounded-xl bg-warning-soft text-warning"><Gavel className="size-5" /></span>
              <div>
                <p className="font-utility text-xs text-muted-foreground">申诉编号 {selected.id.slice(-8).toUpperCase()}</p>
                <h2 className="font-display text-2xl font-medium">复核 {selected.appellant.username} 的申诉</h2>
              </div>
            </div>

            <div className="mt-7 grid grid-cols-2 gap-4">
              <article className="rounded-xl border border-border p-5">
                <p className="text-xs font-bold text-muted-foreground">原治理决定</p>
                <p className="mt-3 text-sm font-bold">{actionLabels[selected.decision.action]}</p>
                <p className="mt-2 text-sm leading-6">{selected.decision.publicExplanation}</p>
                <p className="mt-3 font-utility text-xs text-muted-foreground">目标 {selected.decision.targetType} · {selected.decision.targetId}</p>
              </article>
              <article className="rounded-xl border border-border bg-muted/60 p-5">
                <p className="text-xs font-bold text-muted-foreground">用户申诉陈述</p>
                <p className="mt-3 text-sm leading-7">{selected.statement}</p>
              </article>
            </div>

            {selected.status === "PENDING" ? (
              <HighRiskGate>
                <div className="mt-6 rounded-xl border border-border p-5">
                <p className="text-sm font-bold">复核意见</p>
                <Textarea value={note} onChange={(event) => setNote(event.target.value)} className="mt-3" rows={4} placeholder="说明维持或推翻决定的依据。" />
                <div className="mt-4 flex justify-end gap-2">
                  <Button
                    variant="outline"
                    disabled={note.trim().length === 0 || resolve.isPending}
                    onClick={async () => {
                      try {
                        await resolve.mutateAsync({ id: selected.id, outcome: "UPHELD", note });
                        toast.success("原治理决定已维持");
                        setSelectedId(undefined);
                      } catch (error) {
                        toast.error(getApiErrorMessage(error, "申诉处理失败"));
                      }
                    }}
                  >
                    维持决定
                  </Button>
                  <Button
                    variant="destructive"
                    disabled={note.trim().length === 0 || resolve.isPending}
                    onClick={async () => {
                      try {
                        await resolve.mutateAsync({ id: selected.id, outcome: "OVERTURNED", note });
                        toast.success("治理决定已推翻并撤销原处置");
                        setSelectedId(undefined);
                      } catch (error) {
                        toast.error(getApiErrorMessage(error, "申诉处理失败"));
                      }
                    }}
                  >
                    推翻并撤销处置
                  </Button>
                </div>
                </div>
              </HighRiskGate>
            ) : (
              <div className="mt-6 rounded-xl border border-border bg-muted/60 p-5">
                <div className="flex items-center gap-2">
                  <Badge tone={statusTone(selected.status)}>{statusLabels[selected.status]}</Badge>
                  {selected.handledAt ? <WenyouTime value={selected.handledAt} className="text-xs text-muted-foreground" /> : null}
                </div>
                <p className="mt-3 text-sm leading-6">{selected.handledNote || "未记录复核说明"}</p>
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
