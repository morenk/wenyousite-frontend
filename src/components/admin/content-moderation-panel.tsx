"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { CheckCircle2, ExternalLink, Loader2, RotateCcw, ShieldAlert } from "lucide-react";
import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { getApiErrorMessage } from "@/api/errors";
import { useAdminContentActions } from "@/api/hooks/use-admin";
import type { AdminContentType } from "@/api/admin-types";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Panel } from "@/components/ui/panel";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { parseAdminContentReference, type AdminContentReference } from "@/lib/admin-content-reference";
import { cn } from "@/lib/utils";

const formSchema = z.object({
  action: z.enum(["hide", "restore"]),
  targetType: z.enum(["thread", "post", "moment", "moment_comment"]),
  reference: z.string().trim().min(1, "请粘贴内容链接或填写内容编号"),
  reason: z.string().trim().min(1, "请填写处置理由").max(500, "处置理由最多 500 个字符"),
});

type FormValues = z.infer<typeof formSchema>;
type LastAction = AdminContentReference & { action: FormValues["action"] };

const targetLabels: Record<AdminContentType, string> = {
  thread: "主题帖",
  post: "帖子 / 楼层 / 回复",
  moment: "动态",
  moment_comment: "动态评论 / 回复",
};

const auditTargetTypes: Record<AdminContentType, string> = {
  thread: "THREAD",
  post: "POST",
  moment: "MOMENT",
  moment_comment: "MOMENT_COMMENT",
};

export function ContentModerationPanel() {
  const actions = useAdminContentActions();
  const [lastAction, setLastAction] = useState<LastAction | null>(null);
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      action: "hide",
      targetType: "post",
      reference: "",
      reason: "",
    },
  });
  const action = useWatch({ control: form.control, name: "action" });
  const targetType = useWatch({ control: form.control, name: "targetType" });
  const reference = useWatch({ control: form.control, name: "reference" });
  const parsedPreview = parseAdminContentReference(reference, targetType);
  const pending = actions.hide.isPending || actions.restore.isPending;

  const submit = form.handleSubmit(async (values) => {
    const target = parseAdminContentReference(values.reference, values.targetType);
    if (!target) {
      form.setError("reference", { message: "无法识别此链接；请使用站内内容链接或直接填写内容编号" });
      return;
    }
    try {
      const mutation = values.action === "hide" ? actions.hide : actions.restore;
      await mutation.mutateAsync({ ...target, reason: values.reason });
      setLastAction({ ...target, action: values.action });
      toast.success(`${targetLabels[target.type]}已${values.action === "hide" ? "隐藏" : "恢复"}`);
      form.reset({
        action: values.action,
        targetType: target.type,
        reference: "",
        reason: "",
      });
    } catch (error) {
      toast.error(getApiErrorMessage(error, values.action === "hide" ? "隐藏失败" : "恢复失败"));
    }
  });

  return (
    <div className="mx-auto grid max-w-[76rem] grid-cols-[minmax(0,1fr)_22rem] gap-6">
      <Panel padding="none" className="overflow-hidden">
        <div className={cn(
          "h-1",
          action === "hide" ? "bg-destructive" : "bg-success",
        )} aria-hidden="true" />
        <div className="flex items-start gap-4 border-b border-border px-7 py-6">
          <span className={cn(
            "flex size-11 shrink-0 items-center justify-center rounded-xl",
            action === "hide" ? "bg-destructive-soft text-destructive" : "bg-success-soft text-success",
          )}>
            {action === "hide" ? <ShieldAlert className="size-5" /> : <RotateCcw className="size-5" />}
          </span>
          <div>
            <h2 className="font-display text-xl font-bold">直接处置公开内容</h2>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              粘贴前台链接会自动识别目标；也可以选择类型后直接填写内容编号。
            </p>
          </div>
        </div>

        <form onSubmit={submit} className="space-y-6 px-7 py-7">
          <div className="grid grid-cols-2 gap-5">
            <div className="space-y-2">
              <Label>执行动作</Label>
              <Select
                value={action}
                onValueChange={(value) => form.setValue("action", value as FormValues["action"], { shouldValidate: true })}
              >
                <SelectTrigger className="w-full"><SelectValue>{action === "hide" ? "隐藏内容" : "恢复内容"}</SelectValue></SelectTrigger>
                <SelectContent align="start">
                  <SelectItem value="hide">隐藏内容</SelectItem>
                  <SelectItem value="restore">恢复内容</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>目标类型</Label>
              <Select
                value={targetType}
                onValueChange={(value) => form.setValue("targetType", value as AdminContentType, { shouldValidate: true })}
              >
                <SelectTrigger className="w-full"><SelectValue>{targetLabels[targetType]}</SelectValue></SelectTrigger>
                <SelectContent align="start">
                  {Object.entries(targetLabels).map(([value, label]) => (
                    <SelectItem key={value} value={value}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="content-reference">内容链接或编号</Label>
            <Input
              id="content-reference"
              placeholder="例如 https://wenyou.site/moments/… 或直接填写编号"
              aria-invalid={Boolean(form.formState.errors.reference)}
              {...form.register("reference")}
            />
            {form.formState.errors.reference ? (
              <p className="text-xs text-destructive">{form.formState.errors.reference.message}</p>
            ) : parsedPreview ? (
              <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <CheckCircle2 className="size-3.5 text-success" />
                将处置{targetLabels[parsedPreview.type]} · <code className="font-utility">{parsedPreview.id}</code>
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">主题帖、楼层、楼中楼、动态与动态评论链接均可识别。</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="content-moderation-reason">处置理由</Label>
            <Textarea
              id="content-moderation-reason"
              rows={5}
              maxLength={500}
              placeholder={action === "hide" ? "说明违反的规则与隐藏依据。" : "说明复核结论与恢复依据。"}
              aria-invalid={Boolean(form.formState.errors.reason)}
              {...form.register("reason")}
            />
            {form.formState.errors.reason ? <p className="text-xs text-destructive">{form.formState.errors.reason.message}</p> : null}
          </div>

          <div className="flex items-center justify-between gap-4 border-t border-border pt-5">
            <p className="max-w-xl text-xs leading-5 text-muted-foreground">
              {action === "hide"
                ? "隐藏会立即刷新公开列表，并写入不可变决定轨迹。"
                : "只能恢复由管理员隐藏的内容；作者主动删除的内容不会被改写。"}
            </p>
            <Button type="submit" variant={action === "hide" ? "destructive" : "default"} disabled={pending}>
              {pending ? <Loader2 className="animate-spin" /> : action === "hide" ? <ShieldAlert /> : <RotateCcw />}
              {action === "hide" ? "确认隐藏" : "确认恢复"}
            </Button>
          </div>
        </form>
      </Panel>

      <div className="space-y-5">
        <Panel tone="soft">
          <p className="font-utility text-xs font-bold tracking-[0.12em] text-muted-foreground uppercase">处置边界</p>
          <h3 className="mt-2 font-display text-lg font-bold">隐藏不是删除</h3>
          <ul className="mt-4 space-y-3 text-sm leading-6 text-muted-foreground">
            <li>公开读路径立即排除内容，原作者无法自行恢复。</li>
            <li>站务人员、理由和时间进入审计轨迹。</li>
            <li>恢复不会覆盖作者删除或父级内容不可见状态。</li>
          </ul>
        </Panel>

        {lastAction ? (
          <Panel className="border-success/35">
            <Badge tone="success">刚刚完成</Badge>
            <p className="mt-3 text-sm font-bold">
              {targetLabels[lastAction.type]}已{lastAction.action === "hide" ? "隐藏" : "恢复"}
            </p>
            <code className="mt-2 block break-all font-utility text-xs text-muted-foreground">{lastAction.id}</code>
            <Link
              href={`/station/audit?action=${lastAction.action === "hide" ? "CONTENT_HIDDEN" : "CONTENT_RESTORED"}&target=${auditTargetTypes[lastAction.type]}&id=${encodeURIComponent(lastAction.id)}`}
              className={cn(buttonVariants({ variant: "outline", size: "compact" }), "mt-4")}
            >
              查看审计记录
              <ExternalLink />
            </Link>
          </Panel>
        ) : null}
      </div>
    </div>
  );
}
