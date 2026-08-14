"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { ExternalLink, Loader2, ShieldAlert } from "lucide-react";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { getApiErrorMessage } from "@/api/errors";
import { useAdminContentActions, useAdminSession } from "@/api/hooks/use-admin";
import type { AdminContentType } from "@/api/admin-types";
import { Button, buttonVariants } from "@/components/ui/button";
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
import { cn } from "@/lib/utils";

const reasonSchema = z.object({
  reason: z.string().trim().min(1, "请填写处置理由").max(500, "处置理由最多 500 个字符"),
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
  const session = useAdminSession(open && isAdmin);
  const actions = useAdminContentActions();
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
          <DialogPopup className="max-w-lg">
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
              <DialogCloseButton type="button" label="关闭内容处置" disabled={pending} />
            </div>

            {session.isLoading || session.isFetching ? (
              <div className="flex min-h-48 items-center justify-center gap-2 px-6 py-8 text-sm text-muted-foreground" role="status">
                <Loader2 className="size-4 animate-spin" />
                正在核验站务会话…
              </div>
            ) : session.isError || !session.data ? (
              <div className="space-y-5 px-6 py-6">
                <div className="rounded-xl border border-warning/35 bg-warning-soft px-4 py-3">
                  <p className="text-sm font-bold text-foreground">需要独立站务会话</p>
                  <p className="mt-1 text-sm leading-6 text-muted-foreground">
                    普通登录态只决定是否显示入口，真正的处置仍需通过站务台双重验证。
                  </p>
                </div>
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => void session.refetch()}>
                    重新核验
                  </Button>
                  <Link
                    href="/station"
                    target="_blank"
                    rel="noreferrer"
                    className={cn(buttonVariants(), "gap-2")}
                  >
                    打开站务登录
                    <ExternalLink className="size-4" />
                  </Link>
                </DialogFooter>
              </div>
            ) : (
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
                    toast.error(getApiErrorMessage(error, "隐藏失败，请刷新内容后重试"));
                  }
                })}
              >
                <div className="space-y-5 px-6 py-6">
                  <div className="grid grid-cols-[5rem_minmax(0,1fr)] gap-x-3 gap-y-1 rounded-xl bg-muted px-4 py-3 text-sm">
                    <span className="text-muted-foreground">处置目标</span>
                    <span className="font-bold">{target.label}</span>
                    <span className="text-muted-foreground">内容编号</span>
                    <code className="truncate font-utility text-xs font-bold" title={target.id}>{target.id}</code>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor={`admin-hide-reason-${target.id}`}>处置理由</Label>
                    <Textarea
                      id={`admin-hide-reason-${target.id}`}
                      rows={4}
                      maxLength={500}
                      placeholder="说明违反了哪项规则，以及为何需要从公开页面隐藏。"
                      aria-invalid={Boolean(form.formState.errors.reason)}
                      {...form.register("reason")}
                    />
                    {form.formState.errors.reason ? (
                      <p className="text-xs text-destructive">{form.formState.errors.reason.message}</p>
                    ) : (
                      <p className="text-xs leading-5 text-muted-foreground">
                        此操作不同于作者删除；之后只能在站务台通过内容编号恢复。
                      </p>
                    )}
                  </div>
                </div>
                <DialogFooter className="border-t border-border px-6 py-4">
                  <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={pending}>
                    取消
                  </Button>
                  <Button type="submit" variant="destructive" disabled={pending}>
                    {pending ? <Loader2 className="animate-spin" /> : <ShieldAlert />}
                    确认隐藏
                  </Button>
                </DialogFooter>
              </form>
            )}
          </DialogPopup>
        </DialogViewport>
      </DialogPortal>
    </Dialog>
  );
}
