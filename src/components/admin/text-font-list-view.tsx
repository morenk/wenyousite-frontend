"use client";

import Link from "next/link";
import { ArrowDown, ArrowUp, Search } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { fontLanguageLabels, type FontLanguage } from "@/lib/admin-text-font-upload";
import { AdminFilterBar, AdminFilterField, AdminPagination } from "./admin-list-controls";
import { AdminTable, AdminTableHead, AdminTableBody, AdminTableRow, AdminTableHeader, AdminTableCell, AdminTableActionHeader, AdminTableActionCell } from "./admin-table";

export const fontStatusLabels = { all: "全部状态", draft: "草稿", enabled: "启用", disabled: "停用", withdrawn: "已撤回" } as const;
export const fontSortLabels = { created: "最近新增", updated: "最近修改", name: "名称", display: "展示顺序" } as const;
export interface FontListFilters {
  search: string;
  language: FontLanguage | "all";
  status: keyof typeof fontStatusLabels;
  sort: keyof typeof fontSortLabels;
  direction: "asc" | "desc";
}
export const defaultFontListFilters: FontListFilters = { search: "", language: "all", status: "all", sort: "created", direction: "desc" };
export interface FontListRow {
  id: string;
  name: string;
  language: FontLanguage;
  status: Exclude<keyof typeof fontStatusLabels, "all">;
  currentVersion?: string;
  submissionId?: string;
  processing?: "draft" | "queued" | "processing" | "ready" | "failed";
}
function FilterSelect<T extends string>({ label, value, options, onChange }: {
  label: string; value: T; options: Record<T, string>; onChange: (value: T) => void;
}) {
  return <AdminFilterField label={label} className="w-32">
    <Select value={value} onValueChange={(next) => { if (next && next in options) onChange(next as T); }}>
      <SelectTrigger size="compact" aria-label={label} className="w-full"><SelectValue>{options[value]}</SelectValue></SelectTrigger>
      <SelectContent>{Object.entries<string>(options).map(([key, text]) => <SelectItem key={key} value={key}>{text}</SelectItem>)}</SelectContent>
    </Select>
  </AdminFilterField>;
}
export function TextFontListView({ filters, onFiltersChange, rows, page, hasNext, loading, error, busy = false, onRetry, onPageChange, onReorder }: {
  filters: FontListFilters;
  onFiltersChange: (value: FontListFilters) => void;
  rows: readonly FontListRow[];
  page: number; hasNext: boolean; loading: boolean; error: boolean; busy?: boolean;
  onRetry: () => void; onPageChange: (page: number) => void; onReorder: () => void;
}) {
  const set = (change: Partial<FontListFilters>) => onFiltersChange({ ...filters, ...change });
  const count = Number(Boolean(filters.search)) + Number(filters.language !== "all") + Number(filters.status !== "all");
  return <div className="space-y-3">
    <div className="flex flex-wrap items-center justify-end gap-2">
      <Button variant="outline" onClick={onReorder}>调整展示顺序</Button>
      <Link href="/station/text-fonts/new" className={buttonVariants()}>上传字体</Link>
    </div>
    <section aria-label="字体列表" className="overflow-hidden rounded-[var(--radius-card)] border border-border bg-card">
      <AdminFilterBar inline activeCount={count} onReset={() => onFiltersChange(defaultFontListFilters)}>
        <AdminFilterField label="名称搜索" className="min-w-40 flex-1">
          <span className="relative block"><Search aria-hidden className="pointer-events-none absolute top-2 left-3 size-4 text-muted-foreground" /><Input aria-label="名称搜索" placeholder="搜索字体名称" className="pl-9" value={filters.search} onChange={(event) => set({ search: event.target.value })} /></span>
        </AdminFilterField>
        <FilterSelect label="语言" value={filters.language} options={{ all: "全部语言", ...fontLanguageLabels }} onChange={(language) => set({ language })} />
        <FilterSelect label="状态" value={filters.status} options={fontStatusLabels} onChange={(status) => set({ status })} />
        <FilterSelect label="排序" value={filters.sort} options={fontSortLabels} onChange={(sort) => set({ sort })} />
        <Button size="compact" variant="outline" aria-label={filters.direction === "desc" ? "降序排列，切换为升序" : "升序排列，切换为降序"} onClick={() => set({ direction: filters.direction === "desc" ? "asc" : "desc" })}>
          {filters.direction === "desc" ? <ArrowDown /> : <ArrowUp />}{filters.direction === "desc" ? "降序" : "升序"}
        </Button>
      </AdminFilterBar>
      {error ? <div role="alert" className="flex items-center justify-center gap-3 p-6 text-sm"><span className="text-destructive">字体列表读取失败</span><Button variant="outline" size="compact" disabled={busy} onClick={onRetry}>重试</Button></div>
        : loading ? <p role="status" className="p-6 text-center text-sm text-muted-foreground">正在读取字体…</p>
          : <AdminTable className="min-w-184"><AdminTableHead><AdminTableRow>{["名称", "语言", "状态", "处理", "当前版本"].map((label) => <AdminTableHeader key={label}>{label}</AdminTableHeader>)}<AdminTableActionHeader>操作</AdminTableActionHeader></AdminTableRow></AdminTableHead>
            <AdminTableBody>{rows.map((font) => <AdminTableRow key={font.id}>
              <AdminTableCell className="w-64 max-w-64 font-medium"><span className="block truncate" title={font.name}>{font.name}</span></AdminTableCell>
              <AdminTableCell className="whitespace-nowrap">{fontLanguageLabels[font.language]}</AdminTableCell>
              <AdminTableCell className="whitespace-nowrap"><Badge tone={font.status === "enabled" ? "success" : font.status === "withdrawn" ? "danger" : "neutral"}>{fontStatusLabels[font.status]}</Badge></AdminTableCell>
              <AdminTableCell className="whitespace-nowrap text-sm text-muted-foreground">{font.processing ? ({ draft: "待处理", queued: "排队中", processing: "处理中", ready: "处理完成", failed: "处理失败" } as const)[font.processing] : "—"}</AdminTableCell>
              <AdminTableCell className="font-utility whitespace-nowrap">{font.currentVersion ?? "—"}</AdminTableCell>
              <AdminTableActionCell className="whitespace-nowrap"><Link href={`/station/text-fonts/${font.id}${font.submissionId ? `?submission=${encodeURIComponent(font.submissionId)}` : ""}`} className={buttonVariants({ variant: "ghost", size: "compact" })}>管理</Link></AdminTableActionCell>
            </AdminTableRow>)}{rows.length === 0 && <AdminTableRow><AdminTableCell colSpan={6} className="py-8 text-center text-muted-foreground">{count ? "没有符合条件的字体" : "暂无字体"}</AdminTableCell></AdminTableRow>}</AdminTableBody>
          </AdminTable>}
      {!error && !loading && <AdminPagination className="flex-col items-stretch gap-2 sm:flex-row sm:items-center [&>p]:whitespace-nowrap [&>div]:justify-end" page={page} pageSize={20} visibleCount={rows.length} hasPrevious={page > 1} hasNext={hasNext} onPrevious={() => onPageChange(page - 1)} onNext={() => onPageChange(page + 1)} busy={busy} />}
    </section>
  </div>;
}
