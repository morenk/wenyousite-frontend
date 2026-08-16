"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { getCoreRowModel, getPaginationRowModel, useReactTable } from "@tanstack/react-table";
import { FolderTree, PencilLine, Plus, Tags } from "lucide-react";
import { useQueryStates } from "nuqs";
import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { getApiErrorMessage } from "@/api/errors";
import { useAdminTaxonomy, useAdminTaxonomyActions } from "@/api/hooks/use-admin";
import type { components } from "@/api/types";
import { CategoryEditDialog } from "@/components/admin/category-edit-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  adminTaxonomyFilterParsers,
  adminTaxonomyUrlKeys,
  boundedAdminPageIndex,
} from "@/lib/admin-url-state";
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

type Category = components["schemas"]["ThreadCategoryResponseDto"];
type Tag = components["schemas"]["TagResponseDto"];

const categorySchema = z.object({
  slug: z.string().trim().regex(/^[A-Z][A-Z0-9_]{1,31}$/, "使用 2–32 位大写字母、数字或下划线"),
  name: z.string().trim().min(1).max(50),
});
const tagSchema = z.object({ name: z.string().trim().min(1).max(20) });

function nextSortOrder(items: Array<{ sortOrder: number }>) {
  return items.reduce((highest, item) => Math.max(highest, item.sortOrder), -1) + 1;
}

export function TaxonomyPanel() {
  const taxonomy = useAdminTaxonomy();
  const actions = useAdminTaxonomyActions();
  const [editingCategory, setEditingCategory] = useState<Category>();
  const [{
    categoryQuery,
    categoryStatus,
    categoryPage,
    tagQuery,
    tagStatus,
    tagPage,
  }, setFilters] = useQueryStates(adminTaxonomyFilterParsers, {
    shallow: true,
    urlKeys: adminTaxonomyUrlKeys,
  });
  const categoryForm = useForm<z.infer<typeof categorySchema>>({
    resolver: zodResolver(categorySchema),
    defaultValues: { slug: "", name: "" },
  });
  const tagForm = useForm<z.infer<typeof tagSchema>>({
    resolver: zodResolver(tagSchema),
    defaultValues: { name: "" },
  });
  const filteredCategories = useMemo(() => {
    const keyword = categoryQuery.trim().toLocaleLowerCase();
    return (taxonomy.data?.categories ?? []).filter((category) => {
      if (keyword && !`${category.name} ${category.slug} ${category.description ?? ""}`.toLocaleLowerCase().includes(keyword)) return false;
      if (categoryStatus === "ACTIVE" && !category.isActive) return false;
      if (categoryStatus === "INACTIVE" && category.isActive) return false;
      return true;
    });
  }, [categoryQuery, categoryStatus, taxonomy.data?.categories]);
  const filteredTags = useMemo(() => {
    const keyword = tagQuery.trim().toLocaleLowerCase();
    return (taxonomy.data?.tags ?? []).filter((tag) => {
      if (keyword && !tag.name.toLocaleLowerCase().includes(keyword)) return false;
      if (tagStatus === "ACTIVE" && !tag.isActive) return false;
      if (tagStatus === "INACTIVE" && tag.isActive) return false;
      return true;
    });
  }, [tagQuery, tagStatus, taxonomy.data?.tags]);
  const categoryPageIndex = boundedAdminPageIndex(categoryPage, filteredCategories.length, 8);
  const tagPageIndex = boundedAdminPageIndex(tagPage, filteredTags.length, 8);
  // TanStack Table intentionally exposes mutable table methods; React Compiler skips this component.
  // eslint-disable-next-line react-hooks/incompatible-library
  const categoryTable = useReactTable<Category>({
    data: filteredCategories,
    columns: [],
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    state: { pagination: { pageIndex: categoryPageIndex, pageSize: 8 } },
    onPaginationChange: (updater) => {
      const current = { pageIndex: categoryPageIndex, pageSize: 8 };
      const next = typeof updater === "function" ? updater(current) : updater;
      void setFilters({ categoryPage: next.pageIndex + 1 }, { history: "push" });
    },
    autoResetPageIndex: false,
  });
  const tagTable = useReactTable<Tag>({
    data: filteredTags,
    columns: [],
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    state: { pagination: { pageIndex: tagPageIndex, pageSize: 8 } },
    onPaginationChange: (updater) => {
      const current = { pageIndex: tagPageIndex, pageSize: 8 };
      const next = typeof updater === "function" ? updater(current) : updater;
      void setFilters({ tagPage: next.pageIndex + 1 }, { history: "push" });
    },
    autoResetPageIndex: false,
  });

  if (taxonomy.isLoading) return <p className="text-sm text-muted-foreground">正在读取分类与标签…</p>;
  if (taxonomy.isError || !taxonomy.data) return <p className="text-sm text-destructive">分类与标签加载失败，请刷新后重试。</p>;

  return (
    <>
      <div className="space-y-6">
        <section className="overflow-hidden rounded-lg border border-border bg-card">
          <div className="flex items-center gap-3 px-6 py-5">
            <span className="flex size-10 items-center justify-center rounded-xl bg-accent text-accent-foreground"><FolderTree className="size-5" /></span>
            <div>
              <h2 className="font-display text-xl font-bold">主题帖分类</h2>
              <p className="text-xs text-muted-foreground">名称来自数据库；标识创建后保持稳定。</p>
            </div>
          </div>

          <AdminFilterBar
            activeCount={(categoryQuery.trim() ? 1 : 0) + (categoryStatus ? 1 : 0)}
            onReset={() => void setFilters({ categoryQuery: null, categoryStatus: null, categoryPage: null }, { history: "push" })}
          >
            <AdminFilterField label="关键词" className="w-44">
              <Input value={categoryQuery} onChange={(event) => void setFilters({ categoryQuery: event.target.value, categoryPage: null })} placeholder="名称、标识或说明" />
            </AdminFilterField>
            <AdminFilterField label="状态" className="w-28">
              <Select value={categoryStatus ?? "ALL"} onValueChange={(value) => void setFilters({ categoryStatus: value === "ALL" ? null : value as NonNullable<typeof categoryStatus>, categoryPage: null }, { history: "push" })}>
                <SelectTrigger className="w-full"><SelectValue>{!categoryStatus ? "全部" : categoryStatus === "ACTIVE" ? "启用" : "停用"}</SelectValue></SelectTrigger>
                <SelectContent align="start">
                  <SelectItem value="ALL">全部</SelectItem>
                  <SelectItem value="ACTIVE">启用</SelectItem>
                  <SelectItem value="INACTIVE">停用</SelectItem>
                </SelectContent>
              </Select>
            </AdminFilterField>
          </AdminFilterBar>

          <AdminTable aria-label="主题帖分类">
            <AdminTableHead>
              <tr>
                <AdminTableHeader>分类</AdminTableHeader>
                <AdminTableHeader>稳定标识</AdminTableHeader>
                <AdminTableHeader className="text-right">排序</AdminTableHeader>
                <AdminTableHeader>状态</AdminTableHeader>
                <AdminTableHeader className="text-right">操作</AdminTableHeader>
              </tr>
            </AdminTableHead>
            <AdminTableBody>
            {categoryTable.getRowModel().rows.map(({ original: category }) => (
              <AdminTableRow key={category.id}>
                <AdminTableCell className="max-w-lg">
                  <p className="font-bold">{category.name}</p>
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">{category.description || "未填写分类说明"}</p>
                </AdminTableCell>
                <AdminTableCell className="font-utility text-xs text-muted-foreground">{category.slug}</AdminTableCell>
                <AdminTableCell className="text-right font-utility text-xs">{category.sortOrder}</AdminTableCell>
                <AdminTableCell><Badge tone={category.isActive ? "success" : "neutral"}>{category.isActive ? "启用" : "停用"}</Badge></AdminTableCell>
                <AdminTableCell>
                  <div className="flex justify-end gap-1">
                    <Button type="button" size="icon-compact" variant="ghost" title={`编辑 ${category.name}`} aria-label={`编辑 ${category.name}`} onClick={() => setEditingCategory(category)}>
                      <PencilLine />
                    </Button>
                    <Button
                      type="button"
                      size="compact"
                      variant="ghost"
                      disabled={actions.updateCategory.isPending}
                      onClick={async () => {
                        try {
                          await actions.updateCategory.mutateAsync({ id: category.id, isActive: !category.isActive, reason: "站务台调整分类可用状态" });
                          toast.success(category.isActive ? "分类已停用" : "分类已启用");
                        } catch (error) {
                          toast.error(getApiErrorMessage(error, "分类状态更新失败"));
                        }
                      }}
                    >
                      {category.isActive ? "停用" : "启用"}
                    </Button>
                  </div>
                </AdminTableCell>
              </AdminTableRow>
            ))}
            {categoryTable.getRowModel().rows.length === 0 ? <AdminTableEmpty colSpan={5}>当前筛选下没有分类</AdminTableEmpty> : null}
            </AdminTableBody>
          </AdminTable>
          <AdminPagination
            page={categoryTable.getState().pagination.pageIndex + 1}
            pageSize={categoryTable.getState().pagination.pageSize}
            visibleCount={categoryTable.getRowModel().rows.length}
            hasPrevious={categoryTable.getCanPreviousPage()}
            hasNext={categoryTable.getCanNextPage()}
            onPrevious={() => categoryTable.previousPage()}
            onNext={() => categoryTable.nextPage()}
          />

          <form
            className="grid grid-cols-[1fr_1fr_auto] gap-3 border-t border-border px-6 py-5"
            onSubmit={categoryForm.handleSubmit(async (values) => {
              try {
                await actions.createCategory.mutateAsync({
                  ...values,
                  sortOrder: nextSortOrder(taxonomy.data.categories),
                  isActive: true,
                  reason: "站务台新增分类",
                });
                categoryForm.reset();
                toast.success("分类已创建，可继续补充门面设置");
              } catch (error) {
                toast.error(getApiErrorMessage(error, "分类创建失败"));
              }
            })}
          >
            <div><Label htmlFor="category-name" className="sr-only">分类名称</Label><Input id="category-name" placeholder="分类名称" {...categoryForm.register("name")} /></div>
            <div><Label htmlFor="category-slug" className="sr-only">稳定标识（大写英文）</Label><Input id="category-slug" placeholder="大写英文标识，如 MYSTERY" className="font-utility" {...categoryForm.register("slug")} /></div>
            <Button type="submit" size="icon" title="新增分类"><Plus /></Button>
          </form>
          {categoryForm.formState.errors.slug ? <p className="px-6 pb-2 text-xs text-destructive">{categoryForm.formState.errors.slug.message}</p> : null}
          {categoryForm.formState.errors.name ? <p className="px-6 pb-2 text-xs text-destructive">{categoryForm.formState.errors.name.message}</p> : null}
        </section>

        <section className="overflow-hidden rounded-lg border border-border bg-card">
          <div className="flex items-center gap-3 px-6 py-5">
            <span className="flex size-10 items-center justify-center rounded-xl bg-info-soft text-info"><Tags className="size-5" /></span>
            <div><h2 className="font-display text-xl font-bold">平台标签</h2><p className="text-xs text-muted-foreground">标签停用不会移除已有主题帖关系。</p></div>
          </div>
          <AdminFilterBar
            activeCount={(tagQuery.trim() ? 1 : 0) + (tagStatus ? 1 : 0)}
            onReset={() => void setFilters({ tagQuery: null, tagStatus: null, tagPage: null }, { history: "push" })}
          >
            <AdminFilterField label="关键词" className="w-52">
              <Input value={tagQuery} onChange={(event) => void setFilters({ tagQuery: event.target.value, tagPage: null })} placeholder="标签名称" />
            </AdminFilterField>
            <AdminFilterField label="状态" className="w-32">
              <Select value={tagStatus ?? "ALL"} onValueChange={(value) => void setFilters({ tagStatus: value === "ALL" ? null : value as NonNullable<typeof tagStatus>, tagPage: null }, { history: "push" })}>
                <SelectTrigger className="w-full"><SelectValue>{!tagStatus ? "全部状态" : tagStatus === "ACTIVE" ? "启用" : "停用"}</SelectValue></SelectTrigger>
                <SelectContent align="start">
                  <SelectItem value="ALL">全部状态</SelectItem>
                  <SelectItem value="ACTIVE">启用</SelectItem>
                  <SelectItem value="INACTIVE">停用</SelectItem>
                </SelectContent>
              </Select>
            </AdminFilterField>
          </AdminFilterBar>
          <AdminTable aria-label="平台标签">
            <AdminTableHead>
              <tr>
                <AdminTableHeader>标签名称</AdminTableHeader>
                <AdminTableHeader className="text-right">排序</AdminTableHeader>
                <AdminTableHeader>状态</AdminTableHeader>
                <AdminTableHeader className="text-right">操作</AdminTableHeader>
              </tr>
            </AdminTableHead>
            <AdminTableBody>
            {tagTable.getRowModel().rows.map(({ original: tag }) => (
              <AdminTableRow key={tag.id}>
                <AdminTableCell className="font-bold">#{tag.name}</AdminTableCell>
                <AdminTableCell className="text-right font-utility text-xs">{tag.sortOrder}</AdminTableCell>
                <AdminTableCell><Badge tone={tag.isActive ? "success" : "neutral"}>{tag.isActive ? "启用" : "停用"}</Badge></AdminTableCell>
                <AdminTableCell>
                  <div className="flex justify-end">
                  <Button
                    type="button"
                    size="compact"
                    variant="ghost"
                    disabled={actions.updateTag.isPending}
                    onClick={async () => {
                      try {
                        await actions.updateTag.mutateAsync({ id: tag.id, isActive: !tag.isActive, reason: "站务台调整标签可用状态" });
                      } catch (error) {
                        toast.error(getApiErrorMessage(error, "标签状态更新失败"));
                      }
                    }}
                  >
                    {tag.isActive ? "停用" : "启用"}
                  </Button>
                  </div>
                </AdminTableCell>
              </AdminTableRow>
            ))}
            {tagTable.getRowModel().rows.length === 0 ? <AdminTableEmpty colSpan={4}>当前筛选下没有标签</AdminTableEmpty> : null}
            </AdminTableBody>
          </AdminTable>
          <AdminPagination
            page={tagTable.getState().pagination.pageIndex + 1}
            pageSize={tagTable.getState().pagination.pageSize}
            visibleCount={tagTable.getRowModel().rows.length}
            hasPrevious={tagTable.getCanPreviousPage()}
            hasNext={tagTable.getCanNextPage()}
            onPrevious={() => tagTable.previousPage()}
            onNext={() => tagTable.nextPage()}
          />
          <form
            className="flex gap-3 border-t border-border px-6 py-5"
            onSubmit={tagForm.handleSubmit(async (values) => {
              try {
                await actions.createTag.mutateAsync({ ...values, sortOrder: nextSortOrder(taxonomy.data.tags), isActive: true, reason: "站务台新增标签" });
                tagForm.reset();
                toast.success("标签已创建");
              } catch (error) {
                toast.error(getApiErrorMessage(error, "标签创建失败"));
              }
            })}
          >
            <div className="flex-1"><Label htmlFor="tag-name" className="sr-only">标签名称</Label><Input id="tag-name" placeholder="新标签名称" {...tagForm.register("name")} /></div>
            <Button type="submit"><Plus />新增标签</Button>
          </form>
        </section>
      </div>

      {editingCategory ? (
        <CategoryEditDialog
          key={editingCategory.id}
          category={editingCategory}
          open
          onOpenChange={(nextOpen) => {
            if (!nextOpen) setEditingCategory(undefined);
          }}
        />
      ) : null}
    </>
  );
}
