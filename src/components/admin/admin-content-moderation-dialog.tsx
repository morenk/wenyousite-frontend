"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, ShieldAlert } from "lucide-react";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { getApiErrorMessage } from "@/api/errors";
import { useAdminBearerContentActions } from "@/api/hooks/use-admin";
import type { AdminContentType } from "@/api/admin-types";
import { Button } from "@/components/ui/button";
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
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/lib/auth";

const reasonSchema = z.object({
  reason: z
    .string()
    .trim()
    .min(1, "请填写处置理由")
    .max(500, "处置理由最多 500 个字符"),
});

type ReasonValues = z.infer<typeof reasonSchema>;

export interface AdminModerationTarget {
  type: AdminContentType;
  id: string;
  label: string;
}

export function AdminContentModerationDialog({
  target,
  open,
  onOpenChange,
  onHidden,
}: {
  target: AdminModerationTarget;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onHidden?: () => void;
}) {
  const { user } = useAuth();
  const isAdmin = user?.role === "ADMIN" || user?.role === "SUPER_ADMIN";
  const actions = useAdminBearerContentActions();
  const form = useForm<ReasonValues>({
    resolver: zodResolver(reasonSchema),
    defaultValues: { reason: "" },
  });

  useEffect(() => {
    if (open) form.reset({ reason: "" });
  }, [form, open, target.id]);

  if (!isAdmin) return null;

  const pending = actions.hide.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPortal>
        <DialogBackdrop />
        <DialogViewport>
          <DialogPopup className="max-w-2xl">
            <div className="h-1 bg-destructive" aria-hidden="true" />
            <div className="flex items-start justify-between gap-5 border-b border-border px-6 py-5">
              <div className="flex min-w-0 gap-3">
                <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-xl bg-destructive-soft text-destructive">
                  <ShieldAlert className="size-4.5" />
                </span>
                <div className="min-w-0">
                  <DialogTitle>站务隐藏{target.label}</DialogTitle>
                  <DialogDescription className="mt-1">
                    内容会立即退出公开读路径，并留下管理员、理由与时间的审计记录。
                  </DialogDescription>
                </div>
              </div>
              <DialogCloseButton
                type="button"
                label="关闭内容处置"
                disabled={pending}
              />
            </div>

            <form
              onSubmit={form.handleSubmit(async ({ reason }) => {
                try {
                  await actions.hide.mutateAsync({
                    type: target.type,
                    id: target.id,
                    reason,
                  });
                  toast.success(`${target.label}已由站务隐藏`);
                  onOpenChange(false);
                  onHidden?.();
                } catch (error) {
                  toast.error(
                    getApiErrorMessage(error, "隐藏失败，请刷新内容后重试"),
                  );
                }
              })}
            >
              <div className="space-y-5 px-6 py-6">
                <div className="grid grid-cols-[5rem_minmax(0,1fr)] gap-x-3 gap-y-1 rounded-xl bg-muted px-4 py-3 text-sm">
                  <span className="text-muted-foreground">处置目标</span>
                  <span className="font-bold">{target.label}</span>
                  <span className="text-muted-foreground">内容编号</span>
                  <code
                    className="truncate font-utility text-xs font-bold"
                    title={target.id}
                  >
                    {target.id}
                  </code>
                </div>
                <div className="space-y-2">
                  <Label htmlFor={`admin-hide-reason-${target.id}`}>
                    处置理由
                  </Label>
                  <Textarea
                    id={`admin-hide-reason-${target.id}`}
                    rows={4}
                    maxLength={500}
                    placeholder="说明违反了哪项规则，以及为何需要从公开页面隐藏。"
                    aria-invalid={Boolean(form.formState.errors.reason)}
                    {...form.register("reason")}
                  />
                  {form.formState.errors.reason ? (
                    <p className="text-xs text-destructive">
                      {form.formState.errors.reason.message}
                    </p>
                  ) : (
                    <p className="text-xs leading-5 text-muted-foreground">
                      管理员普通登录态即可执行；操作仍会记录理由、管理员与时间。
                    </p>
                  )}
                </div>
              </div>
              <DialogFooter className="border-t border-border px-6 py-4">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => onOpenChange(false)}
                  disabled={pending}
                >
                  取消
                </Button>
                <Button type="submit" variant="destructive" disabled={pending}>
                  {pending ? (
                    <Loader2 className="animate-spin" />
                  ) : (
                    <ShieldAlert />
                  )}
                  确认隐藏
                </Button>
              </DialogFooter>
            </form>
          </DialogPopup>
        </DialogViewport>
      </DialogPortal>
    </Dialog>
  );
}
