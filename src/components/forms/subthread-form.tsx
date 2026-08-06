/** 子贴创建/编辑表单弹窗 */

"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
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

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30"
      onClick={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <div className="w-full max-w-sm rounded-xl border border-border bg-card p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-base font-semibold">{title}</h3>
          <button
            type="button"
            onClick={onCancel}
            className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            disabled={isSubmitting}
          >
            <X className="h-4 w-4" />
          </button>
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
            <select
              id="policy"
              disabled={isSubmitting}
              className="h-9 w-full rounded-lg border border-border bg-background px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-60"
              {...form.register("postingPolicy")}
            >
              {POSTING_POLICY_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onCancel}
              disabled={isSubmitting}
            >
              取消
            </Button>
            <Button type="submit" size="sm" disabled={isSubmitting}>
              {isSubmitting && (
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              )}
              {mode === "create" ? "添加" : "保存"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
