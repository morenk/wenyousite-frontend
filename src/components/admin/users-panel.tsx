"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { type ColumnDef, flexRender, getCoreRowModel, useReactTable } from "@tanstack/react-table";
import { Search, UserRoundCog } from "lucide-react";
import { useQueryStates } from "nuqs";
import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { useDebounce } from "use-debounce";
import { z } from "zod";
import { getApiErrorMessage } from "@/api/errors";
import { type AdminUser, useAdminUserActions, useAdminUsers } from "@/api/hooks/use-admin";
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogBackdrop,
  DialogCloseButton,
  DialogDescription,
  DialogPopup,
  DialogPortal,
  DialogTitle,
  DialogViewport,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { WenyouTime } from "@/components/shared/wenyou-time";
import { adminUserFilterParsers, adminUserUrlKeys } from "@/lib/admin-url-state";

const sanctionSchema = z.object({
  reason: z.string().trim().min(4, "理由至少 4 个字").max(500),
  endsAt: z.string(),
});
type SanctionValues = z.infer<typeof sanctionSchema>;
const emptyUsers: AdminUser[] = [];

function tone(status: AdminUser["moderationStatus"]) {
  if (status === "ACTIVE") return "success" as const;
  if (status === "SUSPENDED") return "warning" as const;
  return "danger" as const;
}

export function UsersPanel() {
  const [{ query, role, status }, setFilters] = useQueryStates(adminUserFilterParsers, {
    shallow: true,
    urlKeys: adminUserUrlKeys,
  });
  const [debounced] = useDebounce(query, 250);
  const pagination = useCursorPagination(`${debounced}:${role ?? "ALL"}:${status ?? "ALL"}`);
  const users = useAdminUsers({
    q: debounced || undefined,
    role: role ?? undefined,
    status: status ?? undefined,
    cursor: pagination.cursor,
    limit: 20,
  });
  const actions = useAdminUserActions();
  const [selectedId, setSelectedId] = useState<string>();
  const selected = users.data?.items.find((user) => user.id === selectedId);
  const form = useForm<SanctionValues>({
    resolver: zodResolver(sanctionSchema),
    defaultValues: { reason: "", endsAt: "" },
  });
  const columns = useMemo<ColumnDef<AdminUser>[]>(() => [
    { header: "用户", cell: ({ row }) => <div><p className="font-bold">{row.original.username}</p><p className="text-xs text-muted-foreground">{row.original.email}</p></div> },
    { header: "角色", cell: ({ row }) => row.original.role === "USER" ? "普通用户" : row.original.role === "ADMIN" ? "管理员" : "超级管理员" },
    { header: "状态", cell: ({ row }) => <Badge tone={tone(row.original.moderationStatus)}>{row.original.moderationStatus === "ACTIVE" ? "正常" : row.original.moderationStatus === "SUSPENDED" ? "暂停" : "封禁"}</Badge> },
    { header: "加入时间", cell: ({ row }) => <WenyouTime value={row.original.createdAt} className="text-xs text-muted-foreground" /> },
    {
      id: "actions",
      header: "操作",
      cell: ({ row }) => (
        <Button
          type="button"
          size="compact"
          variant="ghost"
          onClick={() => {
            setSelectedId(row.original.id);
            form.reset();
          }}
        >
          管理
        </Button>
      ),
    },
  ], [form]);
  // TanStack Table intentionally exposes mutable table methods; React Compiler skips this component.
  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({ data: users.data?.items ?? emptyUsers, columns, getCoreRowModel: getCoreRowModel() });
  const activeCount = (query.trim() ? 1 : 0) + (role ? 1 : 0) + (status ? 1 : 0);

  const applySanction = (type: "SUSPENSION" | "BAN") => {
    void form.handleSubmit(async (values) => {
      if (!selected) return;
      if (type === "SUSPENSION" && !values.endsAt) {
        form.setError("endsAt", { message: "暂停账号需要结束时间" });
        return;
      }
      try {
        await actions.sanction.mutateAsync({
          id: selected.id,
          type,
          reason: values.reason,
          endsAt: type === "SUSPENSION" ? new Date(values.endsAt).toISOString() : undefined,
        });
        toast.success(type === "BAN" ? "账号已永久封禁" : "账号已暂停");
        form.reset();
        setSelectedId(undefined);
      } catch (error) {
        toast.error(getApiErrorMessage(error, "处罚失败"));
      }
    })();
  };

  return (
    <div data-slot="admin-users-workspace" data-layout="full-table" className="w-full">
      <section className="overflow-hidden rounded-lg border border-border bg-card">
        <AdminFilterBar
          activeCount={activeCount}
          onReset={() => void setFilters(null, { history: "push" })}
          summary={users.data ? `当前页 ${users.data.items.length} 人` : undefined}
        >
          <AdminFilterField label="关键词" className="w-64">
            <span className="relative block">
              <Search className="pointer-events-none absolute top-2.5 left-3.5 size-4 text-muted-foreground" />
              <Input value={query} onChange={(event) => void setFilters({ query: event.target.value })} className="pl-10" placeholder="用户名或邮箱" />
            </span>
          </AdminFilterField>
          <AdminFilterField label="账号角色" className="w-40">
            <Select value={role ?? "ALL"} onValueChange={(value) => void setFilters({ role: value === "ALL" ? null : value as NonNullable<typeof role> }, { history: "push" })}>
              <SelectTrigger className="w-full"><SelectValue>{!role ? "全部角色" : role === "USER" ? "普通用户" : role === "ADMIN" ? "管理员" : "超级管理员"}</SelectValue></SelectTrigger>
              <SelectContent align="start">
                <SelectItem value="ALL">全部角色</SelectItem>
                <SelectItem value="USER">普通用户</SelectItem>
                <SelectItem value="ADMIN">管理员</SelectItem>
                <SelectItem value="SUPER_ADMIN">超级管理员</SelectItem>
              </SelectContent>
            </Select>
          </AdminFilterField>
          <AdminFilterField label="处罚状态" className="w-36">
            <Select value={status ?? "ALL"} onValueChange={(value) => void setFilters({ status: value === "ALL" ? null : value as NonNullable<typeof status> }, { history: "push" })}>
              <SelectTrigger className="w-full"><SelectValue>{!status ? "全部状态" : status === "ACTIVE" ? "正常" : status === "SUSPENDED" ? "暂停" : "封禁"}</SelectValue></SelectTrigger>
              <SelectContent align="start">
                <SelectItem value="ALL">全部状态</SelectItem>
                <SelectItem value="ACTIVE">正常</SelectItem>
                <SelectItem value="SUSPENDED">暂停</SelectItem>
                <SelectItem value="BANNED">封禁</SelectItem>
              </SelectContent>
            </Select>
          </AdminFilterField>
        </AdminFilterBar>
        <AdminTable aria-label="用户列表" className="min-w-[56rem]">
          <AdminTableHead>
            {table.getHeaderGroups().map((group) => (
              <tr key={group.id}>
                {group.headers.map((header) => header.column.id === "actions" ? (
                  <AdminTableActionHeader key={header.id}>
                    {flexRender(header.column.columnDef.header, header.getContext())}
                  </AdminTableActionHeader>
                ) : (
                  <AdminTableHeader key={header.id}>
                    {flexRender(header.column.columnDef.header, header.getContext())}
                  </AdminTableHeader>
                ))}
              </tr>
            ))}
          </AdminTableHead>
          <AdminTableBody>
            {users.isLoading ? <AdminTableEmpty colSpan={5}>正在读取用户…</AdminTableEmpty> : null}
            {users.isError ? <AdminTableEmpty colSpan={5}><span className="text-destructive">用户列表加载失败</span></AdminTableEmpty> : null}
            {table.getRowModel().rows.map((row) => (
              <AdminTableRow key={row.id} data-selected={selectedId === row.original.id}>
                {row.getVisibleCells().map((cell) => cell.column.id === "actions" ? (
                  <AdminTableActionCell key={cell.id}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </AdminTableActionCell>
                ) : (
                  <AdminTableCell key={cell.id}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </AdminTableCell>
                ))}
              </AdminTableRow>
            ))}
            {!users.isLoading && !users.isError && table.getRowModel().rows.length === 0 ? <AdminTableEmpty colSpan={5}>当前筛选下没有用户</AdminTableEmpty> : null}
          </AdminTableBody>
        </AdminTable>
        <AdminPagination
          page={pagination.page}
          pageSize={20}
          visibleCount={users.data?.items.length ?? 0}
          hasPrevious={pagination.hasPrevious}
          hasNext={Boolean(users.data?.meta?.hasMore && users.data.meta.cursor)}
          onPrevious={pagination.previous}
          onNext={() => {
            if (users.data?.meta?.cursor) pagination.next(users.data.meta.cursor);
          }}
          busy={users.isFetching}
        />
      </section>

      {selected ? (
        <Dialog
          open
          onOpenChange={(open) => {
            if (!open && !actions.sanction.isPending && !actions.revoke.isPending) {
              setSelectedId(undefined);
              form.reset();
            }
          }}
        >
          <DialogPortal>
            <DialogBackdrop />
            <DialogViewport>
              <DialogPopup data-admin-action-dialog className="max-w-2xl">
                <div className="flex items-start justify-between gap-5 border-b border-border px-6 py-5">
                  <div className="flex min-w-0 items-start gap-3">
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-accent text-accent-foreground">
                      <UserRoundCog className="size-5" />
                    </span>
                    <div className="min-w-0">
                      <DialogTitle>管理 {selected.username}</DialogTitle>
                      <DialogDescription className="mt-1">{selected.email} · 处罚会立即影响账号访问。</DialogDescription>
                    </div>
                  </div>
                  <DialogCloseButton
                    type="button"
                    label="关闭用户操作"
                    disabled={actions.sanction.isPending || actions.revoke.isPending}
                  />
                </div>
                <div className="px-6 py-6">
                  {selected.currentSanction ? (
                    <div className="rounded-lg bg-destructive-soft p-4 text-sm text-destructive">
                      <p className="font-bold">当前处罚 · {selected.currentSanction.type === "SUSPENSION" ? "暂停账号" : "永久封禁"}</p>
                      <p className="mt-1 text-xs leading-5">{selected.currentSanction.reason}</p>
                      <Button
                        size="compact"
                        variant="outline"
                        className="mt-3"
                        disabled={actions.revoke.isPending}
                        onClick={async () => {
                          try {
                            await actions.revoke.mutateAsync({ id: selected.id, reason: "管理员复核后解除处罚" });
                            toast.success("处罚已解除");
                            setSelectedId(undefined);
                          } catch (error) {
                            toast.error(getApiErrorMessage(error, "解除处罚失败"));
                          }
                        }}
                      >解除处罚</Button>
                    </div>
                  ) : selected.role !== "USER" ? (
                    <p className="rounded-lg bg-muted p-4 text-sm text-muted-foreground">管理员账号需由超级管理员管理。</p>
                  ) : (
                    <form className="space-y-5" onSubmit={(event) => event.preventDefault()}>
                      <div className="space-y-2">
                        <Label htmlFor="sanction-reason">处罚理由</Label>
                        <Textarea id="sanction-reason" rows={4} {...form.register("reason")} />
                        {form.formState.errors.reason ? <p className="text-xs text-destructive">{form.formState.errors.reason.message}</p> : null}
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="sanction-until">暂停至</Label>
                        <Input id="sanction-until" type="datetime-local" {...form.register("endsAt")} />
                        {form.formState.errors.endsAt ? <p className="text-xs text-destructive">{form.formState.errors.endsAt.message}</p> : null}
                      </div>
                      <div className="flex justify-end gap-2 border-t border-border pt-5">
                        <Button type="button" variant="outline" disabled={actions.sanction.isPending} onClick={() => applySanction("SUSPENSION")}>暂停账号</Button>
                        <Button type="button" variant="destructive" disabled={actions.sanction.isPending} onClick={() => applySanction("BAN")}>永久封禁</Button>
                      </div>
                    </form>
                  )}
                </div>
              </DialogPopup>
            </DialogViewport>
          </DialogPortal>
        </Dialog>
      ) : null}
    </div>
  );
}
