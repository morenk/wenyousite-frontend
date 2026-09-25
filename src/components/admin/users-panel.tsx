"use client";

import { type ColumnDef, flexRender, getCoreRowModel, useReactTable } from "@tanstack/react-table";
import { Search } from "lucide-react";
import { useQueryStates } from "nuqs";
import { useMemo } from "react";
import { useDebounce } from "use-debounce";
import { type AdminUser, useAdminUsers } from "@/api/hooks/use-admin";
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
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { adminDetailHref, rememberAdminListPosition, useAdminListReturn } from "@/hooks/use-admin-list-return";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { WenyouTime } from "@/components/shared/wenyou-time";
import { adminUserFilterParsers, adminUserUrlKeys } from "@/lib/admin-url-state";

const emptyUsers: AdminUser[] = [];

function tone(status: AdminUser["moderationStatus"]) {
  if (status === "ACTIVE") return "success" as const;
  if (status === "SUSPENDED") return "warning" as const;
  return "danger" as const;
}

export function UsersPanel() {
  const [{ id, query, role, status }, setFilters] = useQueryStates(adminUserFilterParsers, {
    shallow: true,
    urlKeys: adminUserUrlKeys,
  });
  const [debounced] = useDebounce(query, 250);
  const pagination = useCursorPagination(`${id}:${debounced}:${role ?? "ALL"}:${status ?? "ALL"}`, "admin-users");
  const users = useAdminUsers({
    id: id || undefined,
    q: debounced || undefined,
    role: role ?? undefined,
    status: status ?? undefined,
    cursor: pagination.cursor,
    limit: 20,
  });
  useAdminListReturn(Boolean(users.data));
  const columns = useMemo<ColumnDef<AdminUser>[]>(() => [
    { header: "用户", cell: ({ row }) => <div><p className="font-bold">{row.original.username}</p><p className="text-xs text-muted-foreground">{row.original.email}</p></div> },
    { header: "角色", cell: ({ row }) => row.original.role === "USER" ? "普通用户" : row.original.role === "ADMIN" ? "管理员" : "超级管理员" },
    { header: "状态", cell: ({ row }) => <Badge tone={tone(row.original.moderationStatus)}>{row.original.moderationStatus === "ACTIVE" ? "正常" : row.original.moderationStatus === "SUSPENDED" ? "暂停" : "封禁"}</Badge> },
    { header: "加入时间", cell: ({ row }) => <WenyouTime value={row.original.createdAt} className="text-xs text-muted-foreground" /> },
    {
      id: "actions",
      header: "操作",
      cell: ({ row }) => (
        <Link className={buttonVariants({ variant: "ghost", size: "compact" })}
          href={adminDetailHref("/station/users/" + row.original.id, "/station/users")}
          onClick={rememberAdminListPosition}>查看</Link>
      ),
    },
  ], []);
  // TanStack Table intentionally exposes mutable table methods; React Compiler skips this component.
  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({ data: users.data?.items ?? emptyUsers, columns, getCoreRowModel: getCoreRowModel() });
  const activeCount = (id ? 1 : 0) + (query.trim() ? 1 : 0) + (role ? 1 : 0) + (status ? 1 : 0);

  return (
    <div data-slot="admin-users-workspace" data-layout="full-table" className="w-full">
      <section className="overflow-hidden rounded-[var(--radius-card)] border border-border bg-card">
        <AdminFilterBar
          activeCount={activeCount}
          onReset={() => void setFilters(null, { history: "push" })}
        >
          <AdminFilterField label="用户编号" className="w-44"><Input aria-label="用户编号" value={id} onChange={(event) => void setFilters({ id: event.target.value })} /></AdminFilterField>
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
          <AdminFilterField label="账号状态" className="w-36">
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
              <AdminTableRow key={row.id}>
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

    </div>
  );
}
