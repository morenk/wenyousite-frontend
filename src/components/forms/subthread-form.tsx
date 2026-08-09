/** 子贴创建/编辑表单弹窗 */

"use client";

import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
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
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { POSTING_POLICY_OPTIONS } from "@/lib/post-policy";

const subthreadFormSchema = z.object({
  title: z.string().min(1, "请输入子贴标题").max(100, "子贴标题最多 100 个字符"),
  postingPolicy: z.enum(["PARTICIPANTS", "COLLABORATORS", "PLAYERS"]),
});

export type SubthreadFormData = z.infer<typeof subthreadFormSchema>;

interface SubthreadFormProps {
  mode: "create" | "edit";
  defaultValues?: SubthreadFormData;
  lockTitle?: boolean;
  isSubmitting?: boolean;
  onSubmit: (data: SubthreadFormData) => Promise<void>;
  onCancel: () => void;
}

export function SubthreadForm({
  mode,
  defaultValues,
  lockTitle = false,
  isSubmitting = false,
  onSubmit,
  onCancel,
}: SubthreadFormProps) {
  const form = useForm<SubthreadFormData>({
    resolver: zodResolver(subthreadFormSchema),
    defaultValues: defaultValues ?? {
      title: "",
      postingPolicy: "PARTICIPANTS",
    },
  });

  const title = mode === "create" ? "添加子贴" : "编辑子贴";
  const postingPolicy = useWatch({
    control: form.control,
    name: "postingPolicy",
  });

  return (
    <Dialog
      open
      disablePointerDismissal={isSubmitting}
      onOpenChange={(open) => {
        if (!open && !isSubmitting) onCancel();
      }}
    >
      <DialogPortal>
        <DialogBackdrop />
        <DialogViewport>
          <DialogPopup className="max-w-sm p-6">
            <div className="mb-4 flex items-center justify-between gap-4">
              <DialogTitle>{title}</DialogTitle>
              <DialogCloseButton label="关闭子贴表单" disabled={isSubmitting} />
            </div>

            <form
              onSubmit={form.handleSubmit((data) => onSubmit(data))}
              className="space-y-4"
            >
              <div className="space-y-2">
                <Label htmlFor="subtitle">子贴标题</Label>
                <Input
                  id="subtitle"
                  placeholder="主帖 / 设定区 / 剧情区"
                  disabled={isSubmitting}
                  readOnly={lockTitle}
                  {...form.register("title")}
                />
                {lockTitle && (
                  <p className="text-xs text-muted-foreground">
                    主帖标题请在“主题帖”页签中修改
                  </p>
                )}
                {form.formState.errors.title && (
                  <p className="text-xs text-destructive">
                    {form.formState.errors.title.message}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="policy">发帖权限</Label>
                <Select
                  items={POSTING_POLICY_OPTIONS}
                  value={postingPolicy}
                  onValueChange={(value) => {
                    if (!value) return;
                    form.setValue(
                      "postingPolicy",
                      value as SubthreadFormData["postingPolicy"],
                      { shouldDirty: true, shouldValidate: true },
                    );
                  }}
                  disabled={isSubmitting}
                >
                  <SelectTrigger id="policy" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent align="start">
                    {POSTING_POLICY_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <DialogFooter className="pt-2">
                <DialogClose
                  disabled={isSubmitting}
                  className={buttonVariants({ variant: "ghost", size: "compact" })}
                >
                  取消
                </DialogClose>
                <Button type="submit" size="compact" disabled={isSubmitting}>
                  {isSubmitting && (
                    <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                  )}
                  {mode === "create" ? "添加" : "保存"}
                </Button>
              </DialogFooter>
            </form>
          </DialogPopup>
        </DialogViewport>
      </DialogPortal>
    </Dialog>
  );
}
