"use client";

import { LANGUAGE_ACTIONS } from "@wenyousite/foundation/language";
import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { ExternalLink, Loader2, RotateCcw } from "lucide-react";
import { useQueryStates } from "nuqs";
import { type ReactNode, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { getApiErrorMessage } from "@/api/errors";
import {
  type AdminHiddenContent,
  useAdminContentActions,
  useAdminHiddenContent,
} from "@/api/hooks/use-admin";
import type { AdminContentType } from "@/api/admin-types";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Dialog,
  DialogBackdrop,
  DialogCloseButton,
  DialogDescription,
  DialogFooter,
  DialogPopup,
  DialogPortal,
  DialogTitle,
  DialogViewport,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { WenyouTime } from "@/components/shared/wenyou-time";
import {
  adminHiddenContentFilterParsers,
  adminHiddenContentUrlKeys,
} from "@/lib/admin-url-state";
import { cn } from "@/lib/utils";
import { AdminFilterBar, AdminFilterField, AdminPagination } from "./admin-list-controls";
import {
  AdminTable,
  AdminTableActionCell,
  AdminTableActionHeader,
  AdminTableBody,
  AdminTableCell,
  AdminTableEmpty,
  AdminTableHead,
  AdminTableHeader,
  AdminTableRow,
} from "./admin-table";
import { useCursorPagination } from "@/hooks/use-cursor-pagination";

const targetLabels = {
  THREAD: "主题帖",
  POST: "帖子 / 楼层 / 回复",
  MOMENT: "动态",
  MOMENT_COMMENT: "动态评论 / 回复",
} as const;

const actionTargetTypes: Record<AdminHiddenContent["targetType"], AdminContentType> = {
  THREAD: "thread",
  POST: "post",
  MOMENT: "moment",
  MOMENT_COMMENT: "moment_comment",
};

const restoreSchema = z.object({
  reason: z.string().trim().min(1, "请填写恢复理由").max(500, "恢复理由最多 500 个字符"),
});

type RestoreValues = z.infer<typeof restoreSchema>;

export function HiddenContentList({ headerAction }: { headerAction?: ReactNode } = {}) {
  const [{ targetType }, setFilters] = useQueryStates(adminHiddenContentFilterParsers, {
    shallow: true,
    urlKeys: adminHiddenContentUrlKeys,
  });
  const pagination = useCursorPagination(targetType ?? "ALL");
  const hiddenContent = useAdminHiddenContent({
    targetType: targetType ?? undefined,
    cursor: pagination.cursor,
    limit: 20,
  });
  const actions = useAdminContentActions();
  const [selected, setSelected] = useState<AdminHiddenContent | null>(null);
  const form = useForm<RestoreValues>({
    resolver: zodResolver(restoreSchema),
    defaultValues: { reason: "" },
  });

  const openActions = (item: AdminHiddenContent) => {
    form.reset({ reason: "" });
    setSelected(item);
  };

  const submitRestore = form.handleSubmit(async ({ reason }) => {
    if (!selected) return;
    try {
      await actions.restore.mutateAsync({
        type: actionTargetTypes[selected.targetType],
        id: selected.targetId,
        reason,
      });
      toast.success(`${targetLabels[selected.targetType]}已${LANGUAGE_ACTIONS.restore}`);
      setSelected(null);
    } catch (error) {
      toast.error(getApiErrorMessage(error, `${LANGUAGE_ACTIONS.restore}失败，请刷新列表后${LANGUAGE_ACTIONS.retry}`));
    }
  });

  return (
    <>
      <section className="overflow-hidden rounded-lg border border-border bg-card">
        <div className="flex items-center justify-between gap-5 border-b border-border px-6 py-5">
          <div className="flex items-center gap-3">
            <span className="flex size-10 items-center justify-center rounded-xl bg-success-soft text-success">
              <RotateCcw className="size-5" />
            </span>
            <div>
              <h2 className="font-display text-lg font-medium">当前隐藏内容</h2>
              <p className="text-xs text-muted-foreground">这里只显示仍处于站务隐藏状态的内容；恢复后会立即移出列表。</p>
            </div>
          </div>
          {headerAction}
        </div>
        <AdminFilterBar
          activeCount={targetType ? 1 : 0}
          onReset={() => void setFilters(null, { history: "push" })}
          summary={hiddenContent.data ? `当前页 ${hiddenContent.data.items.length} 条` : undefined}
        >
          <AdminFilterField label="内容类型" className="w-48">
            <Select
              value={targetType ?? "ALL"}
              onValueChange={(value) => void setFilters({
                targetType: value === "ALL" ? null : value as NonNullable<typeof targetType>,
              }, { history: "push" })}
            >
              <SelectTrigger className="w-full">
                <SelectValue>{targetType ? targetLabels[targetType] : "全部类型"}</SelectValue>
              </SelectTrigger>
              <SelectContent align="start">
                <SelectItem value="ALL">全部类型</SelectItem>
                {Object.entries(targetLabels).map(([value, label]) => (
                  <SelectItem key={value} value={value}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </AdminFilterField>
        </AdminFilterBar>
        <AdminTable aria-label="当前隐藏内容" className="min-w-[56rem]">
          <AdminTableHead>
            <tr>
              <AdminTableHeader>内容</AdminTableHeader>
              <AdminTableHeader>作者</AdminTableHeader>
              <AdminTableHeader>隐藏记录</AdminTableHeader>
              <AdminTableHeader>恢复状态</AdminTableHeader>
              <AdminTableActionHeader className="min-w-36">操作</AdminTableActionHeader>
            </tr>
          </AdminTableHead>
          <AdminTableBody>
            {hiddenContent.isLoading ? <AdminTableEmpty colSpan={5}>正在读取隐藏内容…</AdminTableEmpty> : null}
            {hiddenContent.isError ? (
              <AdminTableEmpty colSpan={5}><span className="text-destructive">隐藏内容加载失败</span></AdminTableEmpty>
            ) : null}
            {hiddenContent.data?.items.map((item) => (
              <AdminTableRow key={`${item.targetType}:${item.targetId}`}>
                <AdminTableCell className="max-w-md">
                  <div className="flex items-center gap-2">
                    <Badge tone="neutral">{targetLabels[item.targetType]}</Badge>
                    <code className="truncate font-utility text-[0.6875rem] text-muted-foreground" title={item.targetId}>
                      {item.targetId}
                    </code>
                  </div>
                  <p className="mt-1.5 line-clamp-2 text-sm leading-5" title={item.summary}>{item.summary}</p>
                </AdminTableCell>
                <AdminTableCell className="font-bold whitespace-nowrap">{item.author.username}</AdminTableCell>
                <AdminTableCell className="max-w-sm text-xs leading-5">
                  <WenyouTime value={item.hiddenAt} className="text-muted-foreground" />
                  <p className="mt-1 line-clamp-2" title={item.reason ?? undefined}>{item.reason || "未填写理由"}</p>
                  <p className="text-muted-foreground">站务：{item.moderator?.username ?? "未知"}</p>
                </AdminTableCell>
                <AdminTableCell>
                  {item.canRestore ? (
                    <Badge tone="success">可恢复</Badge>
                  ) : (
                    <div className="max-w-52">
                      <Badge tone="warning">父级不可见</Badge>
                      <p className="mt-1 text-xs leading-5 text-muted-foreground">{item.restoreBlockedReason}</p>
                    </div>
                  )}
                </AdminTableCell>
                <AdminTableActionCell className="min-w-36 whitespace-nowrap">
                  <Button type="button" size="compact" variant="ghost" onClick={() => openActions(item)}>操作</Button>
                </AdminTableActionCell>
              </AdminTableRow>
            ))}
            {!hiddenContent.isLoading && !hiddenContent.isError && hiddenContent.data?.items.length === 0 ? (
              <AdminTableEmpty colSpan={5}>当前筛选下没有被站务隐藏的内容</AdminTableEmpty>
            ) : null}
          </AdminTableBody>
        </AdminTable>
        <AdminPagination
          page={pagination.page}
          pageSize={20}
          visibleCount={hiddenContent.data?.items.length ?? 0}
          hasPrevious={pagination.hasPrevious}
          hasNext={Boolean(hiddenContent.data?.meta?.hasMore && hiddenContent.data.meta.cursor)}
          onPrevious={pagination.previous}
          onNext={() => {
            if (hiddenContent.data?.meta?.cursor) pagination.next(hiddenContent.data.meta.cursor);
          }}
          busy={hiddenContent.isFetching}
        />
      </section>

      <Dialog open={Boolean(selected)} onOpenChange={(open) => {
        if (!open && !actions.restore.isPending) setSelected(null);
      }}>
        <DialogPortal>
          <DialogBackdrop />
          <DialogViewport>
            <DialogPopup data-admin-action-dialog className="max-w-2xl">
              <div className="flex items-start justify-between gap-5 border-b border-border px-6 py-5">
                <div>
                  <DialogTitle>{selected ? targetLabels[selected.targetType] : "内容"}操作</DialogTitle>
                  <DialogDescription className="mt-1">查看审计记录，或在允许时填写理由恢复内容。</DialogDescription>
                </div>
                <DialogCloseButton type="button" label="关闭内容操作" disabled={actions.restore.isPending} />
              </div>
              <div className="space-y-4 px-6 py-6">
                  <div className="rounded-xl bg-muted px-4 py-3">
                    <p className="line-clamp-2 text-sm font-bold">{selected?.summary}</p>
                    <code className="mt-1 block truncate font-utility text-xs text-muted-foreground">{selected?.targetId}</code>
                  </div>
                  {selected ? (
                    <Link
                      href={`/station/audit?action=CONTENT_HIDDEN&target=${selected.targetType}&id=${encodeURIComponent(selected.targetId)}`}
                      className={cn(buttonVariants({ variant: "outline", size: "compact" }), "gap-1.5")}
                    >
                      查看审计记录<ExternalLink />
                    </Link>
                  ) : null}
                  {selected?.canRestore ? (
                    <form onSubmit={submitRestore} className="space-y-4 border-t border-border pt-4">
                  <div className="space-y-2">
                    <Label htmlFor="hidden-content-restore-reason">恢复理由</Label>
                    <Textarea
                      id="hidden-content-restore-reason"
                      rows={4}
                      maxLength={500}
                      placeholder="说明复核结论与恢复依据。"
                      aria-invalid={Boolean(form.formState.errors.reason)}
                      {...form.register("reason")}
                    />
                    {form.formState.errors.reason ? (
                      <p className="text-xs text-destructive">{form.formState.errors.reason.message}</p>
                    ) : null}
                  </div>
                      <DialogFooter>
                        <Button type="button" variant="ghost" disabled={actions.restore.isPending} onClick={() => setSelected(null)}>
                          {LANGUAGE_ACTIONS.cancel}
                        </Button>
                        <Button type="submit" disabled={actions.restore.isPending}>
                          {actions.restore.isPending ? <Loader2 className="animate-spin" /> : <RotateCcw />}
                          确认{LANGUAGE_ACTIONS.restore}
                        </Button>
                      </DialogFooter>
                    </form>
                  ) : selected ? (
                    <div className="rounded-xl border border-warning/30 bg-warning-soft p-4 text-sm">
                      <p className="font-bold text-warning">当前无法恢复</p>
                      <p className="mt-1 text-xs leading-5 text-muted-foreground">{selected.restoreBlockedReason || "父级内容当前不可见。"}</p>
                    </div>
                  ) : null}
              </div>
            </DialogPopup>
          </DialogViewport>
        </DialogPortal>
      </Dialog>
    </>
  );
}
