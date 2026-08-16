"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { LockKeyhole } from "lucide-react";
import { useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { getApiErrorMessage } from "@/api/errors";
import { useAdminTaxonomyActions } from "@/api/hooks/use-admin";
import type { components } from "@/api/types";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Dialog,
  DialogBackdrop,
  DialogClose,
  DialogCloseButton,
  DialogDescription,
  DialogFooter,
  DialogPopup,
  DialogPortal,
  DialogTitle,
  DialogViewport,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type Category = components["schemas"]["ThreadCategoryResponseDto"];

const editSchema = z.object({
  name: z.string().trim().min(1, "请输入分类名称").max(50, "名称最多 50 个字符"),
  description: z.string().trim().max(200, "说明最多 200 个字符"),
  sortOrder: z.number().int("排序必须是整数").min(0, "排序不能小于 0"),
});

type EditValues = z.infer<typeof editSchema>;

export function CategoryEditDialog({
  category,
  open,
  onOpenChange,
}: {
  category: Category;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const actions = useAdminTaxonomyActions();
  const form = useForm<EditValues>({
    resolver: zodResolver(editSchema),
    defaultValues: {
      name: category.name,
      description: category.description ?? "",
      sortOrder: category.sortOrder,
    },
  });
  const description = useWatch({ control: form.control, name: "description" });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPortal>
        <DialogBackdrop />
        <DialogViewport>
          <DialogPopup className="max-w-2xl">
            <form
              onSubmit={form.handleSubmit(async (values) => {
                try {
                  await actions.updateCategory.mutateAsync({
                    id: category.id,
                    name: values.name,
                    description: values.description || null,
                    sortOrder: values.sortOrder,
                    reason: "站务台更新分类设置",
                  });
                  toast.success("分类设置已保存");
                  onOpenChange(false);
                } catch (error) {
                  toast.error(getApiErrorMessage(error, "分类设置保存失败"));
                }
              })}
            >
              <div className="flex items-start justify-between gap-5 border-b border-border px-7 py-6">
                <div>
                  <DialogTitle>编辑分类门面</DialogTitle>
                  <DialogDescription className="mt-1">
                    名称会立即用于历史主题帖和所有新选择入口。
                  </DialogDescription>
                </div>
                <DialogCloseButton type="button" label="关闭分类编辑" />
              </div>

              <div className="space-y-6 px-7 py-6">
                <div className="grid grid-cols-[1fr_auto] items-center gap-5 rounded-xl border border-border bg-muted px-4 py-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <LockKeyhole className="size-4 shrink-0 text-muted-foreground" />
                    <div className="min-w-0">
                      <p className="text-xs text-muted-foreground">不可变登记标识</p>
                      <code className="font-utility text-sm font-bold">{category.slug}</code>
                    </div>
                  </div>
                  <p className="max-w-64 text-right text-xs leading-5 text-muted-foreground">
                    历史主题帖和链接依赖此标识；重命名不会改变它。
                  </p>
                </div>

                <div className="grid grid-cols-[1fr_9rem] gap-5">
                  <div className="space-y-2">
                    <Label htmlFor={`category-edit-name-${category.id}`}>展示名称</Label>
                    <Input id={`category-edit-name-${category.id}`} {...form.register("name")} />
                    {form.formState.errors.name ? <p className="text-xs text-destructive">{form.formState.errors.name.message}</p> : null}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor={`category-edit-sort-${category.id}`}>排序</Label>
                    <Input id={`category-edit-sort-${category.id}`} type="number" min={0} {...form.register("sortOrder", { valueAsNumber: true })} />
                    {form.formState.errors.sortOrder ? <p className="text-xs text-destructive">{form.formState.errors.sortOrder.message}</p> : null}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor={`category-edit-description-${category.id}`}>分类说明</Label>
                  <Textarea id={`category-edit-description-${category.id}`} rows={3} placeholder="帮助创作者判断什么内容适合放在这里" {...form.register("description")} />
                  <div className="flex justify-between gap-4 text-xs text-muted-foreground">
                    {form.formState.errors.description ? <span className="text-destructive">{form.formState.errors.description.message}</span> : <span>会显示在站务配置中，后续可供选择器使用。</span>}
                    <span>{description.length}/200</span>
                  </div>
                </div>

              </div>

              <DialogFooter className="border-t border-border bg-muted/45 px-7 py-4">
                <DialogClose type="button" className={buttonVariants({ variant: "outline" })}>取消</DialogClose>
                <Button type="submit" disabled={!form.formState.isDirty || actions.updateCategory.isPending}>
                  {actions.updateCategory.isPending ? "正在保存…" : "保存分类设置"}
                </Button>
              </DialogFooter>
            </form>
          </DialogPopup>
        </DialogViewport>
      </DialogPortal>
    </Dialog>
  );
}
