"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import {
  type ColumnDef,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { format, formatDistanceToNowStrict } from "date-fns";
import { zhCN } from "date-fns/locale";
import { Scale, ShieldAlert } from "lucide-react";
import { useQueryStates } from "nuqs";
import { useCallback, useEffect, useMemo } from "react";
import { useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import type {
  CaseStatus,
  CaseSummary,
  DecisionAction,
  ReasonCode,
  TargetType,
} from "@/api/admin-types";
import { getApiErrorMessage } from "@/api/errors";
import { useAdminCase, useAdminCases, useResolveAdminCase } from "@/api/hooks/use-admin";
import {
  AdminFilterBar,
  AdminFilterField,
  AdminPagination,
} from "@/components/admin/admin-list-controls";
import {
  AdminTable,
  AdminTableBody,
  AdminTableCell,
  AdminTableEmpty,
  AdminTableHead,
  AdminTableHeader,
  AdminTableRow,
} from "@/components/admin/admin-table";
import { useCursorPagination } from "@/components/admin/use-cursor-pagination";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { adminCaseFilterParsers, adminCaseUrlKeys } from "@/lib/admin-url-state";
import { cn } from "@/lib/utils";

const targetLabels: Record<TargetType, string> = {
  USER: "用户",
  THREAD: "主题帖",
  POST: "帖子",
  MOMENT: "动态",
  MOMENT_COMMENT: "动态评论",
  DIRECT_MESSAGE: "私聊消息",
};

const reasonLabels: Record<ReasonCode, string> = {
  SPAM: "垃圾信息",
  HARASSMENT: "骚扰攻击",
  HATE_OR_THREATS: "仇恨或威胁",
  SEXUAL_CONTENT: "色情内容",
  VIOLENT_CONTENT: "暴力内容",
  PERSONAL_INFORMATION: "泄露个人信息",
  IMPERSONATION_OR_FRAUD: "冒充或欺诈",
  INTELLECTUAL_PROPERTY: "知识产权",
  ILLEGAL_CONTENT: "违法内容",
  OTHER: "其他",
};

const actionOptions: Array<{ value: DecisionAction; label: string }> = [
  { value: "HIDE_CONTENT", label: "隐藏内容" },
  { value: "SUSPEND_USER", label: "暂停账号" },
  { value: "BAN_USER", label: "永久封禁" },
];

const reasonOptions = Object.entries(reasonLabels).map(([value, label]) => ({
  value: value as ReasonCode,
  label,
}));

const targetOptions = Object.entries(targetLabels).map(([value, label]) => ({
  value: value as TargetType,
  label,
}));
const emptyCases: CaseSummary[] = [];

const resolutionSchema = z
  .object({
    outcome: z.enum(["RESOLVED", "DISMISSED"]),
    action: z.enum(["HIDE_CONTENT", "SUSPEND_USER", "BAN_USER"]).optional(),
    policyCode: z.enum([
      "SPAM",
      "HARASSMENT",
      "HATE_OR_THREATS",
      "SEXUAL_CONTENT",
      "VIOLENT_CONTENT",
      "PERSONAL_INFORMATION",
      "IMPERSONATION_OR_FRAUD",
      "INTELLECTUAL_PROPERTY",
      "ILLEGAL_CONTENT",
      "OTHER",
    ]),
    publicExplanation: z.string().trim().min(4, "公开说明至少 4 个字").max(500),
    internalNote: z.string().trim().max(1000).optional(),
    suspendUntil: z.string().optional(),
  })
  .superRefine((value, context) => {
    if (value.outcome === "RESOLVED" && !value.action) {
      context.addIssue({ code: "custom", path: ["action"], message: "确认违规时请选择处置动作" });
    }
    if (value.outcome === "DISMISSED" && value.action) {
      context.addIssue({ code: "custom", path: ["action"], message: "驳回案件不能执行处置" });
    }
    if (value.action === "SUSPEND_USER" && !value.suspendUntil) {
      context.addIssue({ code: "custom", path: ["suspendUntil"], message: "请选择暂停结束时间" });
    }
  });

type ResolutionValues = z.infer<typeof resolutionSchema>;

function statusTone(status: CaseStatus) {
  if (status === "OPEN") return "warning" as const;
  if (status === "RESOLVED") return "success" as const;
  return "neutral" as const;
}

function caseColumns(onSelect: (id: string) => void): ColumnDef<CaseSummary>[] {
  return [
    {
      id: "status",
      header: "状态",
      cell: ({ row }) => <Badge tone={statusTone(row.original.status)}>{row.original.status === "OPEN" ? "待处理" : row.original.status === "RESOLVED" ? "已处置" : "已驳回"}</Badge>,
    },
    {
      id: "case",
      header: "案件摘要",
      cell: ({ row }) => {
        const item = row.original;
        const latest = item.reports[0];
        return (
          <div className="max-w-56">
            <div className="flex items-center gap-2">
              <p className="line-clamp-1 font-bold">{latest ? reasonLabels[latest.reasonCode] : "未分类举报"}</p>
              <span className="shrink-0 text-xs text-muted-foreground">{targetLabels[item.targetType]}</span>
            </div>
            <p className="mt-0.5 line-clamp-2 text-xs leading-5 text-muted-foreground">{latest?.details || `目标 ${item.targetId}`}</p>
          </div>
        );
      },
    },
    { id: "reports", header: "举报", cell: ({ row }) => <span className="font-utility text-xs whitespace-nowrap">{row.original._count.reports} 份</span> },
    { id: "createdAt", header: "建案", cell: ({ row }) => <span className="font-utility text-xs whitespace-nowrap text-muted-foreground">{formatDistanceToNowStrict(new Date(row.original.createdAt), { addSuffix: true, locale: zhCN })}</span> },
    { id: "actions", header: "操作", cell: ({ row }) => <Button type="button" size="compact" variant="ghost" onClick={() => onSelect(row.original.id)}>查看</Button> },
  ];
}

export function CaseWorkbench() {
  const [{ status, targetType, reasonCode, selectedCaseId }, setFilters] = useQueryStates(adminCaseFilterParsers, {
    shallow: true,
    urlKeys: adminCaseUrlKeys,
  });
  const selectedId = selectedCaseId ?? undefined;
  const pagination = useCursorPagination(`${status}:${targetType ?? "ALL"}:${reasonCode ?? "ALL"}`);
  const cases = useAdminCases({
    status,
    targetType: targetType ?? undefined,
    reasonCode: reasonCode ?? undefined,
    cursor: pagination.cursor,
    limit: 20,
  });
  const detail = useAdminCase(selectedId);
  const selectCase = useCallback((id: string) => {
    void setFilters({ selectedCaseId: id });
  }, [setFilters]);
  const columns = useMemo(() => caseColumns(selectCase), [selectCase]);
  // TanStack Table intentionally exposes mutable table methods; React Compiler skips this component.
  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data: cases.data?.items ?? emptyCases,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  useEffect(() => {
    const first = cases.data?.items[0];
    const selectionVisible = cases.data?.items.some((item) => item.id === selectedId);
    if (first && !selectionVisible) selectCase(first.id);
  }, [cases.data?.items, selectCase, selectedId]);

  const setStatus = (nextStatus: CaseStatus) => {
    void setFilters({ status: nextStatus, selectedCaseId: null }, { history: "push" });
  };

  return (
    <div className="grid h-full grid-cols-[34rem_minmax(0,1fr)] overflow-hidden">
      <section className="flex min-h-0 flex-col border-r border-border bg-card">
        <div className="border-b border-border p-4">
          <div className="grid grid-cols-3 rounded-lg bg-muted p-1 text-xs font-bold">
            {(["OPEN", "RESOLVED", "DISMISSED"] as CaseStatus[]).map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setStatus(value)}
                className={cn(
                  "rounded-md px-2 py-2 transition-colors",
                  status === value ? "bg-card text-foreground shadow-sm" : "text-muted-foreground",
                )}
              >
                {value === "OPEN" ? "待处理" : value === "RESOLVED" ? "已处置" : "已驳回"}
              </button>
            ))}
          </div>
          <p className="mt-3 text-xs text-muted-foreground">同一目标的多份举报会合并为一个案件。</p>
        </div>
        <AdminFilterBar
          activeCount={(status === "OPEN" ? 0 : 1) + (targetType ? 1 : 0) + (reasonCode ? 1 : 0)}
          onReset={() => void setFilters(null, { history: "push" })}
          className="px-3"
        >
          <AdminFilterField label="目标类型" className="w-32">
            <Select value={targetType ?? "ALL"} onValueChange={(value) => void setFilters({ targetType: value === "ALL" ? null : value as TargetType, selectedCaseId: null }, { history: "push" })}>
              <SelectTrigger className="w-full"><SelectValue>{!targetType ? "全部目标" : targetLabels[targetType]}</SelectValue></SelectTrigger>
              <SelectContent align="start">
                <SelectItem value="ALL">全部目标</SelectItem>
                {targetOptions.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </AdminFilterField>
          <AdminFilterField label="举报原因" className="w-32">
            <Select value={reasonCode ?? "ALL"} onValueChange={(value) => void setFilters({ reasonCode: value === "ALL" ? null : value as ReasonCode, selectedCaseId: null }, { history: "push" })}>
              <SelectTrigger className="w-full"><SelectValue>{!reasonCode ? "全部原因" : reasonLabels[reasonCode]}</SelectValue></SelectTrigger>
              <SelectContent align="start">
                <SelectItem value="ALL">全部原因</SelectItem>
                {reasonOptions.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </AdminFilterField>
        </AdminFilterBar>
        <div className="min-h-0 flex-1 overflow-y-auto">
          <AdminTable aria-label="治理案件队列">
            <AdminTableHead className="sticky top-0 z-10">
              {table.getHeaderGroups().map((group) => (
                <tr key={group.id}>
                  {group.headers.map((header) => <AdminTableHeader key={header.id} className={header.column.id === "actions" ? "text-right" : undefined}>{flexRender(header.column.columnDef.header, header.getContext())}</AdminTableHeader>)}
                </tr>
              ))}
            </AdminTableHead>
            <AdminTableBody>
              {cases.isLoading ? <AdminTableEmpty colSpan={5}>正在读取案件…</AdminTableEmpty> : null}
              {cases.isError ? <AdminTableEmpty colSpan={5}><span className="text-destructive">案件队列加载失败</span></AdminTableEmpty> : null}
              {table.getRowModel().rows.map((row) => (
                <AdminTableRow key={row.id} data-selected={selectedId === row.original.id}>
                  {row.getVisibleCells().map((cell) => (
                    <AdminTableCell key={cell.id} className={cell.column.id === "actions" ? "text-right" : undefined}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</AdminTableCell>
                  ))}
                </AdminTableRow>
              ))}
              {!cases.isLoading && !cases.isError && table.getRowModel().rows.length === 0 ? <AdminTableEmpty colSpan={5}><span><strong className="block text-foreground">这个队列已经清空</strong><span className="mt-1 block text-xs">新的举报会自动出现在这里。</span></span></AdminTableEmpty> : null}
            </AdminTableBody>
          </AdminTable>
        </div>
        <AdminPagination
          page={pagination.page}
          pageSize={20}
          visibleCount={cases.data?.items.length ?? 0}
          hasPrevious={pagination.hasPrevious}
          hasNext={Boolean(cases.data?.meta?.hasMore && cases.data.meta.cursor)}
          onPrevious={pagination.previous}
          onNext={() => {
            if (cases.data?.meta?.cursor) pagination.next(cases.data.meta.cursor);
          }}
          busy={cases.isFetching}
          className="px-3"
        />
      </section>

      <section className="min-w-0 overflow-y-auto bg-background">
        {!selectedId ? (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">从左侧选择一个案件</div>
        ) : detail.isLoading ? (
          <p className="p-8 text-sm text-muted-foreground">正在整理证据与决定轨迹…</p>
        ) : detail.isError || !detail.data ? (
          <p className="p-8 text-sm text-destructive">案件详情加载失败</p>
        ) : (
          <CaseDetail detail={detail.data} />
        )}
      </section>
    </div>
  );
}

function CaseDetail({ detail }: { detail: NonNullable<ReturnType<typeof useAdminCase>["data"]> }) {
  const resolve = useResolveAdminCase();
  const form = useForm<ResolutionValues>({
    resolver: zodResolver(resolutionSchema),
    defaultValues: {
      outcome: "RESOLVED",
      policyCode: detail.reports[0]?.reasonCode ?? "OTHER",
      publicExplanation: "",
      internalNote: "",
      suspendUntil: "",
    },
  });
  const outcome = useWatch({ control: form.control, name: "outcome" });
  const action = useWatch({ control: form.control, name: "action" });
  const policyCode = useWatch({ control: form.control, name: "policyCode" });
  const allowedActions = detail.targetType === "USER" || detail.targetType === "DIRECT_MESSAGE"
    ? actionOptions.filter((item) => item.value !== "HIDE_CONTENT")
    : actionOptions;

  return (
    <div className="mx-auto max-w-[76rem] px-7 py-7">
      <div className="flex items-start justify-between gap-6 border-b border-border pb-6">
        <div>
          <div className="flex items-center gap-2">
            <Badge tone={statusTone(detail.status)}>{detail.status === "OPEN" ? "待处理" : detail.status === "RESOLVED" ? "已处置" : "已驳回"}</Badge>
            <span className="font-utility text-xs text-muted-foreground">案件编号 {detail.id.slice(-8).toUpperCase()}</span>
          </div>
          <h2 className="mt-3 font-display text-2xl font-bold">{targetLabels[detail.targetType]}治理案件</h2>
          <p className="mt-2 font-utility text-xs text-muted-foreground">目标编号 · {detail.targetId}</p>
        </div>
        <div className="text-right text-xs text-muted-foreground">
          <p>建案 {format(new Date(detail.createdAt), "yyyy-MM-dd HH:mm")}</p>
          <p className="mt-1">累计 {detail.reports.length} 份举报</p>
        </div>
      </div>

      <div className={cn("grid gap-7 py-7", detail.status === "OPEN" ? "grid-cols-[minmax(0,1fr)_23rem]" : "grid-cols-1")}>
        <div className="min-w-0 space-y-7">
          <section>
            <div className="mb-3 flex items-center gap-2">
              <ShieldAlert className="size-4 text-brand-strong" />
              <h3 className="font-display text-lg font-bold">举报与留存证据</h3>
            </div>
            <div className="space-y-3">
              {detail.reports.map((report) => (
                <article key={report.id} className="rounded-xl border border-border bg-card p-5">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <Badge tone="danger">{reasonLabels[report.reasonCode]}</Badge>
                      <span className="text-xs text-muted-foreground">举报人 {report.reporter?.username ?? "账号已注销"}</span>
                    </div>
                    <time className="font-utility text-xs text-muted-foreground">{format(new Date(report.createdAt), "MM-dd HH:mm")}</time>
                  </div>
                  {report.details ? <p className="mt-4 text-sm leading-6">{report.details}</p> : null}
                  <details className="mt-4 rounded-lg bg-muted px-4 py-3">
                    <summary className="cursor-pointer text-xs font-bold text-muted-foreground">查看举报时快照</summary>
                    <pre className="mt-3 max-h-64 overflow-auto whitespace-pre-wrap font-mono text-xs leading-5 text-foreground">
                      {JSON.stringify(report.targetSnapshot, null, 2)}
                    </pre>
                  </details>
                </article>
              ))}
            </div>
          </section>

          <section>
            <div className="mb-3 flex items-center gap-2">
              <Scale className="size-4 text-brand-strong" />
              <h3 className="font-display text-lg font-bold">决定轨迹</h3>
            </div>
            {detail.decisions.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border p-5 text-sm text-muted-foreground">尚未作出治理决定。</div>
            ) : (
              <ol className="space-y-3">
                {detail.decisions.map((decision) => (
                  <li key={decision.id} className="rounded-xl border border-border bg-card p-5">
                    <div className="flex items-center gap-2">
                      <Badge tone={decision.active ? "success" : "neutral"}>{decision.active ? "生效中" : "已撤销"}</Badge>
                      <span className="text-sm font-bold">{actionOptions.find((item) => item.value === decision.action)?.label}</span>
                    </div>
                    <p className="mt-3 text-sm leading-6">{decision.publicExplanation}</p>
                    <p className="mt-3 text-xs text-muted-foreground">由 {decision.actor.username} 于 {format(new Date(decision.createdAt), "yyyy-MM-dd HH:mm")} 作出</p>
                  </li>
                ))}
              </ol>
            )}
          </section>
        </div>

        {detail.status === "OPEN" ? (
          <aside className="self-start rounded-2xl border border-border bg-card p-5">
            <p className="font-utility text-xs font-bold tracking-[0.1em] text-muted-foreground">案件处置</p>
            <h3 className="mt-1 font-display text-xl font-bold">形成治理决定</h3>
            <p className="mt-2 text-xs leading-5 text-muted-foreground">公开说明会提供给被处置用户，并成为申诉依据。</p>
            <form
              className="mt-5 space-y-4"
              onSubmit={form.handleSubmit(async (values) => {
                try {
                  await resolve.mutateAsync({
                    id: detail.id,
                    ...values,
                    action: values.outcome === "DISMISSED" ? undefined : values.action,
                    internalNote: values.internalNote || undefined,
                    suspendUntil: values.suspendUntil ? new Date(values.suspendUntil).toISOString() : undefined,
                  });
                  toast.success(values.outcome === "RESOLVED" ? "案件已处置" : "案件已驳回");
                } catch (error) {
                  toast.error(getApiErrorMessage(error, "结案失败，请刷新后重试"));
                }
              })}
            >
              <div className="space-y-2">
                <Label>案件结论</Label>
                <Select
                  items={[{ value: "RESOLVED", label: "确认违规" }, { value: "DISMISSED", label: "驳回举报" }]}
                  value={outcome}
                  onValueChange={(value) => {
                    form.setValue("outcome", value as ResolutionValues["outcome"], { shouldValidate: true });
                    if (value === "DISMISSED") form.setValue("action", undefined, { shouldValidate: true });
                  }}
                >
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent align="start">
                    <SelectItem value="RESOLVED">确认违规</SelectItem>
                    <SelectItem value="DISMISSED">驳回举报</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {outcome === "RESOLVED" ? (
                <div className="space-y-2">
                  <Label>处置动作</Label>
                  <Select
                    items={allowedActions}
                    value={action ?? null}
                    onValueChange={(value) => form.setValue("action", value as DecisionAction, { shouldValidate: true })}
                  >
                    <SelectTrigger className="w-full"><SelectValue placeholder="选择处置" /></SelectTrigger>
                    <SelectContent align="start">
                      {allowedActions.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  {form.formState.errors.action ? <p className="text-xs text-destructive">{form.formState.errors.action.message}</p> : null}
                </div>
              ) : null}
              <div className="space-y-2">
                <Label>规则分类</Label>
                <Select
                  items={reasonOptions}
                  value={policyCode}
                  onValueChange={(value) => form.setValue("policyCode", value as ReasonCode)}
                >
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent align="start">
                    {reasonOptions.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              {action === "SUSPEND_USER" && outcome === "RESOLVED" ? (
                <div className="space-y-2">
                  <Label htmlFor="suspend-until">暂停至</Label>
                  <Input id="suspend-until" type="datetime-local" {...form.register("suspendUntil")} />
                  {form.formState.errors.suspendUntil ? <p className="text-xs text-destructive">{form.formState.errors.suspendUntil.message}</p> : null}
                </div>
              ) : null}
              <div className="space-y-2">
                <Label htmlFor="public-explanation">公开说明</Label>
                <Textarea id="public-explanation" rows={4} placeholder="说明违反了什么规则，以及为什么采取这个动作。" {...form.register("publicExplanation")} />
                {form.formState.errors.publicExplanation ? <p className="text-xs text-destructive">{form.formState.errors.publicExplanation.message}</p> : null}
              </div>
              <div className="space-y-2">
                <Label htmlFor="internal-note">内部备注（可选）</Label>
                <Textarea id="internal-note" rows={3} placeholder="交接信息、相似案件等，仅站务可见。" {...form.register("internalNote")} />
              </div>
              <Button type="submit" className="w-full" disabled={resolve.isPending}>
                {resolve.isPending ? "正在写入决定…" : outcome === "RESOLVED" ? "确认并结案" : "驳回并结案"}
              </Button>
            </form>
          </aside>
        ) : null}
      </div>
    </div>
  );
}
