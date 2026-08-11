"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { format } from "date-fns";
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

const schema = z.object({ statement: z.string().trim().min(10, "请至少写 10 个字").max(2000) });

export function ModerationDecisionsPanel() {
  const { user } = useAuth();
  const decisions = useMyModerationDecisions(user?.id);
  if (decisions.isLoading) return <p className="mt-8 text-sm text-muted-foreground">正在读取治理决定…</p>;
  if (decisions.isError) return <p className="mt-8 text-sm text-destructive">治理决定加载失败</p>;
  return (
    <div className="mx-auto mt-8 max-w-3xl space-y-4">
      {decisions.data?.map((decision) => <DecisionCard key={decision.id} decision={decision} userId={user?.id} />)}
      {decisions.data?.length === 0 ? <div className="rounded-2xl border border-dashed border-border p-10 text-center"><Scale className="mx-auto size-7 text-muted-foreground" /><p className="mt-3 text-sm font-bold">近 30 天没有治理决定</p></div> : null}
    </div>
  );
}

function DecisionCard({ decision, userId }: { decision: UserModerationDecision; userId?: string }) {
  const appeal = useSubmitModerationAppeal(userId);
  const form = useForm<z.infer<typeof schema>>({ resolver: zodResolver(schema), defaultValues: { statement: "" } });
  return (
    <article className="rounded-2xl border border-border bg-card p-6">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-2"><Badge tone={decision.active ? "warning" : "neutral"}>{decision.active ? "生效中" : "已撤销"}</Badge><span className="text-sm font-bold">{decision.action}</span></div>
        <time className="font-utility text-xs text-muted-foreground">{format(new Date(decision.createdAt), "yyyy-MM-dd HH:mm")}</time>
      </div>
      <p className="mt-4 text-sm leading-7">{decision.publicExplanation}</p>
      <p className="mt-3 font-utility text-xs text-muted-foreground">规则 {decision.policyCode} · {decision.targetType} {decision.targetId}</p>
      {decision.appeal ? (
        <div className="mt-5 rounded-xl bg-muted p-4">
          <div className="flex items-center gap-2"><p className="text-sm font-bold">已提交申诉</p><Badge tone={decision.appeal.status === "PENDING" ? "info" : decision.appeal.status === "OVERTURNED" ? "success" : "neutral"}>{decision.appeal.status}</Badge></div>
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
