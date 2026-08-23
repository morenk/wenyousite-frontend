"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Scale } from "lucide-react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { getApiErrorMessage } from "@/api/errors";
import { type UserModerationDecision, useMyModerationDecisions, useSubmitModerationAppeal } from "@/api/hooks/use-moderation-actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/lib/auth";
import { WenyouTime } from "@/components/shared/wenyou-time";

const schema = z.object({ statement: z.string().trim().min(10, "请至少写 10 个字").max(2000) });

const actionLabels: Record<string, string> = {
  HIDE_CONTENT: "隐藏内容",
  SUSPEND_USER: "暂停账号",
  BAN_USER: "永久封禁",
};

const targetLabels: Record<string, string> = {
  USER: "用户",
  THREAD: "主题帖",
  POST: "帖子内容",
  MOMENT: "动态",
  MOMENT_COMMENT: "评论",
  DIRECT_MESSAGE: "私聊消息",
};

const policyLabels: Record<string, string> = {
  SPAM: "垃圾信息",
  HARASSMENT: "骚扰或人身攻击",
  HATE_OR_THREATS: "仇恨言论或威胁",
  SEXUAL_CONTENT: "色情内容",
  VIOLENT_CONTENT: "暴力内容",
  PERSONAL_INFORMATION: "泄露个人信息",
  IMPERSONATION_OR_FRAUD: "冒充或欺诈",
  INTELLECTUAL_PROPERTY: "知识产权问题",
  ILLEGAL_CONTENT: "违法内容",
  OTHER: "其他",
};

const appealStatusLabels = {
  PENDING: "待复核",
  UPHELD: "维持决定",
  OVERTURNED: "已撤销",
} as const;

export function ModerationDecisionsPanel() {
  const { user } = useAuth();
  const decisions = useMyModerationDecisions(user?.id);
  if (decisions.isLoading) return <p className="mt-8 text-sm text-muted-foreground">正在读取治理决定…</p>;
  if (decisions.isError) return <p className="mt-8 text-sm text-destructive">治理决定加载失败</p>;
  return (
    <div className="mx-auto mt-8 w-full max-w-3xl space-y-4">
      {decisions.data?.map((decision) => <DecisionCard key={decision.id} decision={decision} userId={user?.id} />)}
      {decisions.data?.length === 0 ? <div className="rounded-2xl border border-dashed border-border p-10 text-center"><Scale className="mx-auto size-7 text-muted-foreground" /><p className="mt-3 text-sm font-bold">近 30 天没有治理决定</p></div> : null}
    </div>
  );
}

function DecisionCard({ decision, userId }: { decision: UserModerationDecision; userId?: string }) {
  const appeal = useSubmitModerationAppeal(userId);
  const form = useForm<z.infer<typeof schema>>({ resolver: zodResolver(schema), defaultValues: { statement: "" } });
  return (
    <article className="w-full rounded-2xl border border-border bg-card p-6">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-2"><Badge tone={decision.active ? "warning" : "neutral"}>{decision.active ? "生效中" : "已撤销"}</Badge><span className="text-sm font-bold">{actionLabels[decision.action] ?? "治理决定"}</span></div>
        <WenyouTime value={decision.createdAt} className="text-xs text-muted-foreground" />
      </div>
      <p className="mt-4 text-sm leading-7">{decision.publicExplanation}</p>
      <p className="mt-3 text-xs text-muted-foreground">{policyLabels[decision.policyCode] ?? "其他"} · {targetLabels[decision.targetType] ?? "相关内容"}</p>
      {decision.appeal ? (
        <div className="mt-5 rounded-xl bg-muted p-4">
          <div className="flex items-center gap-2"><p className="text-sm font-bold">已提交申诉</p><Badge tone={decision.appeal.status === "PENDING" ? "info" : decision.appeal.status === "OVERTURNED" ? "success" : "neutral"}>{appealStatusLabels[decision.appeal.status]}</Badge></div>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">{decision.appeal.statement}</p>
          {decision.appeal.handledNote ? <p className="mt-3 border-t border-border pt-3 text-sm">站务复核：{decision.appeal.handledNote}</p> : null}
        </div>
      ) : decision.active ? (
        <form className="mt-5 border-t border-border pt-5" onSubmit={form.handleSubmit(async (values) => {
          try { await appeal.mutateAsync({ decisionId: decision.id, statement: values.statement }); toast.success("申诉已提交"); }
          catch (error) { toast.error(getApiErrorMessage(error, "申诉提交失败")); }
        })}>
          <Textarea rows={4} placeholder="说明你认为决定需要复核的事实和理由。每项决定只能申诉一次。" {...form.register("statement")} />
          {form.formState.errors.statement ? <p className="mt-2 text-xs text-destructive">{form.formState.errors.statement.message}</p> : null}
          <div className="mt-3 flex justify-end"><Button type="submit" variant="outline" disabled={appeal.isPending}>{appeal.isPending ? "正在提交…" : "提交申诉"}</Button></div>
        </form>
      ) : null}
    </article>
  );
}
