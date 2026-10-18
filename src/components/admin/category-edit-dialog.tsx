"use client";

import { useSubmissionLock } from "@/hooks/use-submission-lock";
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
  DialogFooter,
  DialogPopup,
  DialogPortal,
  DialogTitle,
  DialogViewport,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/ui/form-field";
import { Textarea } from "@/components/ui/textarea";

type Category = components["schemas"]["ThreadCategoryResponseDto"];

export const editSchema = z.object({
  name: z.string().trim().min(1, "请输入分类名称").refine((value) => Array.from(value).length <= 50, "名称最多 50 个字符"),
  description: z.string().trim().refine((value) => Array.from(value).length <= 200, "说明最多 200 个字符"),
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
  const submission = useSubmissionLock();
  const form = useForm<EditValues>({
    resolver: zodResolver(editSchema),
    defaultValues: {
      name: category.name,
      description: category.description ?? "",
      sortOrder: category.sortOrder,
    },
  });
  const description = useWatch({ control: form.control, name: "description" });

  const pending = submission.pending || form.formState.isSubmitting || actions.updateCategory.isPending;

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!pending) onOpenChange(next); }}>
      <DialogPortal>
        <DialogBackdrop />
        <DialogViewport>
          <DialogPopup className="max-w-2xl">
            <form
              onSubmit={form.handleSubmit(submission.guard(async (values) => {
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
              }))}
            >
              <div className="flex items-start justify-between gap-5 border-b border-border px-4 py-3">
                <div>
                  <DialogTitle>编辑分类</DialogTitle>
                </div>
                <DialogCloseButton type="button" label="关闭分类编辑" disabled={pending} />
              </div>

              <div className="space-y-4 px-4 py-3">
                <div className="grid grid-cols-[1fr_auto] items-center gap-5 rounded-[var(--radius-card)] border border-border bg-muted px-4 py-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <LockKeyhole className="size-4 shrink-0 text-muted-foreground" />
                    <div className="min-w-0">
                      <p className="text-xs text-muted-foreground">分类标识（不可修改）</p>
                      <code className="font-utility text-sm font-bold">{category.slug}</code>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-[1fr_9rem] gap-5">
                  <FormField id={`category-edit-name-${category.id}`} label="展示名称"
                    description="修改名称会同步显示在已有主题帖中。" error={form.formState.errors.name?.message}>
                    {(controlProps) => <Input {...controlProps} {...form.register("name")} />}
                  </FormField>
                  <FormField id={`category-edit-sort-${category.id}`} label="排序" error={form.formState.errors.sortOrder?.message}>
                    {(controlProps) => <Input {...controlProps} type="number" min={0} {...form.register("sortOrder", { valueAsNumber: true })} />}
                  </FormField>
                </div>

                <FormField id={`category-edit-description-${category.id}`} label="分类说明"
                  description={<span className="block text-right">{Array.from(description).length}/200</span>} error={form.formState.errors.description?.message}>
                  {(controlProps) => <Textarea {...controlProps} rows={3} placeholder="帮助创作者判断什么内容适合放在这里" {...form.register("description")} />}
                </FormField>

              </div>

              <DialogFooter className="border-t border-border bg-muted/45 px-7 py-4">
                <DialogClose type="button" disabled={pending} className={buttonVariants({ variant: "outline" })}>取消</DialogClose>
                <Button type="submit" disabled={!form.formState.isDirty} pending={pending} pendingLabel="正在保存…">
                  保存分类设置
                </Button>
              </DialogFooter>
            </form>
          </DialogPopup>
        </DialogViewport>
      </DialogPortal>
    </Dialog>
  );
}
