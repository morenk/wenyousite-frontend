"use client";

import Link from "next/link";
import { useMemo, type ReactNode } from "react";
import { useQueryStates } from "nuqs";
import { useDebounce } from "use-debounce";
import { type ColumnDef, flexRender, getCoreRowModel, useReactTable } from "@tanstack/react-table";
import { type AdminContent, useAdminContent, useAdminTaxonomy } from "@/api/hooks/use-admin";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { WenyouTime } from "@/components/shared/wenyou-time";
import { useCursorPagination } from "@/hooks/use-cursor-pagination";
import { adminDetailHref, rememberAdminListPosition, useAdminListReturn } from "@/hooks/use-admin-list-return";
import { adminContentFilterParsers } from "@/lib/admin-url-state";
import { adminBeijingDate, adminContentLabels } from "@/lib/admin-content-management";
import { AdminFilterBar, AdminFilterField, AdminPagination } from "./admin-list-controls";
import { AdminTable, AdminTableActionCell, AdminTableActionHeader, AdminTableBody, AdminTableCell, AdminTableEmpty, AdminTableHead, AdminTableHeader, AdminTableRow } from "./admin-table";

const emptyContent: AdminContent[] = [];

export function ContentList({ headerAction }: { headerAction?: ReactNode }) {
  const [filters, setFilters] = useQueryStates(adminContentFilterParsers, { shallow: true });
  const [query] = useDebounce(filters.q, 250);
  const taxonomy = useAdminTaxonomy();
  const pagination = useCursorPagination(JSON.stringify({ ...filters, q: query }), "admin-content");
  const invalidRange = Boolean(filters.from && filters.to && filters.from > filters.to);
  const content = useAdminContent({
    type: filters.type, q: query || undefined, id: filters.id || undefined,
    authorId: filters.authorId || undefined, status: filters.status ?? undefined,
    createdAfter: adminBeijingDate(filters.from), createdBefore: adminBeijingDate(filters.to, true),
    category: filters.type === "thread" ? filters.category || undefined : undefined,
    tagId: filters.type === "thread" ? filters.tagId || undefined : undefined,
    cursor: pagination.cursor, limit: filters.limit === "50" ? 50 : 20,
  });
  useAdminListReturn(Boolean(content.data));
  const columns = useMemo<ColumnDef<AdminContent>[]>(() => [
    { header: "内容", cell: ({ row }) => <Link className="block max-w-md truncate font-semibold hover:underline" href={adminDetailHref(`/station/content/${row.original.type}/${row.original.id}`, "/station/content")} onClick={rememberAdminListPosition}>{row.original.title || row.original.summary || "无文字内容"}</Link> },
    { header: "作者", cell: ({ row }) => <Link className="hover:underline" href={adminDetailHref(`/station/users/${row.original.author.id}`, "/station/content")} onClick={rememberAdminListPosition}>{row.original.author.username}</Link> },
    { header: "所属内容", cell: ({ row }) => row.original.type === "thread" ? (taxonomy.data?.categories.find((category) => category.slug === row.original.category)?.name ?? row.original.category ?? "—") : row.original.threadId ? <Link className="text-xs hover:underline" href={adminDetailHref(`/station/content/thread/${row.original.threadId}`, "/station/content")} onClick={rememberAdminListPosition}>主题帖</Link> : row.original.momentId ? <Link className="text-xs hover:underline" href={adminDetailHref(`/station/content/moment/${row.original.momentId}`, "/station/content")} onClick={rememberAdminListPosition}>动态</Link> : "—" },
    { header: "状态", cell: ({ row }) => <span className="flex items-center gap-1"><Badge tone={row.original.hidden ? "warning" : "success"}>{row.original.hidden ? "已隐藏" : "正常"}</Badge>{row.original.parentHidden ? <Badge tone="neutral">父级已隐藏</Badge> : null}</span> },
    { header: "创建时间", cell: ({ row }) => <WenyouTime value={row.original.createdAt} className="whitespace-nowrap text-xs" /> },
    { id: "actions", header: "操作", cell: ({ row }) => <Link className={buttonVariants({ size: "compact", variant: "ghost" })} href={adminDetailHref(`/station/content/${row.original.type}/${row.original.id}`, "/station/content")} onClick={rememberAdminListPosition}>查看</Link> },
  ], [taxonomy.data]);
  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({ data: content.data?.items ?? emptyContent, columns, getCoreRowModel: getCoreRowModel() });
  const activeCount = [filters.q, filters.id, filters.authorId, filters.status, filters.from, filters.to, filters.category, filters.tagId].filter(Boolean).length;
  return <section aria-busy={content.isFetching} className="overflow-hidden rounded-lg border border-border bg-card">
    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-3 py-1">
      <Tabs value={filters.type} onValueChange={(value) => void setFilters({ type: value as typeof filters.type, category: "", tagId: "" })} className="w-auto">
        <TabsList variant="line" className="max-w-full flex-wrap justify-start" style={{ height: "auto", minHeight: 40 }}>{Object.entries(adminContentLabels).map(([type, label]) => <TabsTrigger key={type} value={type} className="min-h-8">{label}</TabsTrigger>)}</TabsList>
      </Tabs><div className="flex items-center gap-2">{content.isFetching && content.data ? <span role="status" className="text-xs text-muted-foreground">更新中…</span> : null}{headerAction}</div>
    </div>
    <AdminFilterBar inline activeCount={activeCount} onReset={() => void setFilters({ q: "", id: "", authorId: "", status: null, from: "", to: "", category: "", tagId: "" })}>
      <AdminFilterField label="关键词" className="w-44"><Input aria-label="关键词" value={filters.q} onChange={(event) => void setFilters({ q: event.target.value })} /></AdminFilterField>
      <AdminFilterField label="内容编号" className="w-36"><Input aria-label="内容编号" value={filters.id} onChange={(event) => void setFilters({ id: event.target.value })} /></AdminFilterField>
      <AdminFilterField label="作者编号" className="w-36"><Input aria-label="作者编号" value={filters.authorId} onChange={(event) => void setFilters({ authorId: event.target.value })} /></AdminFilterField>
      <AdminFilterField label="状态" className="w-28"><Select value={filters.status ?? "ALL"} onValueChange={(value) => void setFilters({ status: value === "ALL" ? null : value as "ACTIVE" | "HIDDEN" })}><SelectTrigger size="compact" className="w-full"><SelectValue>{filters.status === "ACTIVE" ? "正常" : filters.status === "HIDDEN" ? "已隐藏" : "全部"}</SelectValue></SelectTrigger><SelectContent><SelectItem value="ALL">全部</SelectItem><SelectItem value="ACTIVE">正常</SelectItem><SelectItem value="HIDDEN">已隐藏</SelectItem></SelectContent></Select></AdminFilterField>
      <AdminFilterField label="开始日期" className="w-36"><Input type="date" className="px-2 text-sm" aria-label="开始日期" value={filters.from} onChange={(event) => void setFilters({ from: event.target.value })} /></AdminFilterField>
      <AdminFilterField label="结束日期" className="w-36"><Input type="date" className="px-2 text-sm" aria-label="结束日期" value={filters.to} onChange={(event) => void setFilters({ to: event.target.value })} /></AdminFilterField>
      {filters.type === "thread" ? <>
        <AdminFilterField label="分类" className="w-32"><Select value={filters.category || "ALL"} onValueChange={(value) => void setFilters({ category: value === "ALL" ? "" : value ?? "" })}><SelectTrigger size="compact" className="w-full"><SelectValue>{taxonomy.data?.categories.find((item) => item.slug === filters.category)?.name ?? (filters.category || "全部分类")}</SelectValue></SelectTrigger><SelectContent><SelectItem value="ALL">全部分类</SelectItem>{taxonomy.data?.categories.map((item) => <SelectItem key={item.id} value={item.slug}>{item.name}{item.isActive ? "" : "（停用）"}</SelectItem>)}</SelectContent></Select></AdminFilterField>
        <AdminFilterField label="标签" className="w-32"><Select value={filters.tagId || "ALL"} onValueChange={(value) => void setFilters({ tagId: value === "ALL" ? "" : value ?? "" })}><SelectTrigger size="compact" className="w-full"><SelectValue>{taxonomy.data?.tags.find((item) => item.id === filters.tagId)?.name ?? (filters.tagId || "全部标签")}</SelectValue></SelectTrigger><SelectContent><SelectItem value="ALL">全部标签</SelectItem>{taxonomy.data?.tags.map((item) => <SelectItem key={item.id} value={item.id}>{item.name}{item.isActive ? "" : "（停用）"}</SelectItem>)}</SelectContent></Select></AdminFilterField>
      </> : null}
      <AdminFilterField label="每页" className="w-24"><Select value={filters.limit} onValueChange={(value) => void setFilters({ limit: value as "20" | "50" })}><SelectTrigger size="compact" className="w-full"><SelectValue>{filters.limit} 条</SelectValue></SelectTrigger><SelectContent><SelectItem value="20">20 条</SelectItem><SelectItem value="50">50 条</SelectItem></SelectContent></Select></AdminFilterField>
    </AdminFilterBar>
    {invalidRange ? <p role="alert" className="px-3 py-2 text-sm text-destructive">结束日期不能早于开始日期</p> : null}
    {taxonomy.isError && filters.type === "thread" ? <p role="alert" className="px-3 py-2 text-sm text-destructive">分类与标签读取失败 <Button size="compact" variant="ghost" onClick={() => void taxonomy.refetch()}>重试</Button></p> : null}
    <AdminTable aria-label="内容列表" className="min-w-[48rem]">
      <AdminTableHead>{table.getHeaderGroups().map((group) => <tr key={group.id}>{group.headers.map((header) => header.column.id === "actions" ? <AdminTableActionHeader key={header.id}>{flexRender(header.column.columnDef.header, header.getContext())}</AdminTableActionHeader> : <AdminTableHeader key={header.id}>{flexRender(header.column.columnDef.header, header.getContext())}</AdminTableHeader>)}</tr>)}</AdminTableHead>
      <AdminTableBody>
        {content.isLoading ? <AdminTableEmpty colSpan={6}>正在读取内容…</AdminTableEmpty> : null}
        {content.isError ? <AdminTableEmpty colSpan={6}><span role="alert" className="text-destructive">内容加载失败</span><Button size="compact" variant="ghost" onClick={() => void content.refetch()}>重试</Button></AdminTableEmpty> : null}
        {!invalidRange && !content.isError && table.getRowModel().rows.map((row) => <AdminTableRow key={row.original.id}>{row.getVisibleCells().map((cell) => cell.column.id === "actions" ? <AdminTableActionCell key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</AdminTableActionCell> : <AdminTableCell key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</AdminTableCell>)}</AdminTableRow>)}
        {!content.isLoading && !content.isError && !content.data?.items.length ? <AdminTableEmpty colSpan={6}>当前筛选下没有内容</AdminTableEmpty> : null}
      </AdminTableBody>
    </AdminTable>
    <AdminPagination page={pagination.page} pageSize={Number(filters.limit)} visibleCount={content.data?.items.length ?? 0} hasPrevious={pagination.hasPrevious} hasNext={Boolean(content.data?.meta?.hasMore && content.data.meta.cursor)} onPrevious={pagination.previous} onNext={() => { if (content.data?.meta?.cursor) pagination.next(content.data.meta.cursor); }} busy={content.isFetching} />
  </section>;
}
