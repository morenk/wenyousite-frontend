"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Flag } from "lucide-react";
import { useRouter } from "next/navigation";
import { useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { getApiErrorMessage } from "@/api/errors";
import { useSubmitReport } from "@/api/hooks/use-moderation-actions";
import type { components } from "@/api/types";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

type TargetType = components["schemas"]["CreateReportDto"]["targetType"];
type ReasonCode = components["schemas"]["CreateReportDto"]["reasonCode"];

const reasons: Array<{ value: ReasonCode; label: string }> = [
  { value: "SPAM", label: "垃圾信息" },
  { value: "HARASSMENT", label: "骚扰或人身攻击" },
  { value: "HATE_OR_THREATS", label: "仇恨言论或威胁" },
  { value: "SEXUAL_CONTENT", label: "色情内容" },
  { value: "VIOLENT_CONTENT", label: "暴力内容" },
  { value: "PERSONAL_INFORMATION", label: "泄露个人信息" },
  { value: "IMPERSONATION_OR_FRAUD", label: "冒充或欺诈" },
  { value: "INTELLECTUAL_PROPERTY", label: "知识产权问题" },
  { value: "ILLEGAL_CONTENT", label: "违法内容" },
  { value: "OTHER", label: "其他" },
];

const schema = z.object({
  reasonCode: z.enum(reasons.map(({ value }) => value) as [ReasonCode, ...ReasonCode[]]),
  details: z.string().trim().max(1000),
}).superRefine((value, context) => {
  if (value.reasonCode === "OTHER" && !value.details) context.addIssue({ code: "custom", path: ["details"], message: "选择其他时请补充说明" });
});

export function ReportForm({ targetType, targetId }: { targetType: TargetType; targetId: string }) {
  const router = useRouter();
  const submit = useSubmitReport();
  const form = useForm<z.infer<typeof schema>>({ resolver: zodResolver(schema), defaultValues: { reasonCode: "SPAM", details: "" } });
  const reasonCode = useWatch({ control: form.control, name: "reasonCode" });
  return (
    <section className="mx-auto mt-8 max-w-xl rounded-2xl border border-border bg-card p-7">
      <span className="flex size-11 items-center justify-center rounded-xl bg-destructive-soft text-destructive"><Flag className="size-5" /></span>
      <h1 className="mt-5 font-display text-2xl font-medium">举报这项内容</h1>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">举报会保留当前内容快照；同一目标的多份举报由站务合并处理。</p>
      <p className="mt-4 rounded-lg bg-muted px-4 py-3 font-utility text-xs text-muted-foreground">{targetType} · {targetId}</p>
      <form className="mt-6 space-y-4" onSubmit={form.handleSubmit(async (values) => {
        try {
          await submit.mutateAsync({ targetType, targetId, reasonCode: values.reasonCode, ...(values.details ? { details: values.details } : {}) });
          toast.success("举报已提交");
          router.back();
        } catch (error) { toast.error(getApiErrorMessage(error, "举报提交失败")); }
      })}>
        <div className="space-y-2">
          <Label>举报原因</Label>
          <Select items={reasons} value={reasonCode} onValueChange={(value) => form.setValue("reasonCode", value as ReasonCode, { shouldValidate: true })}>
            <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
            <SelectContent align="start">{reasons.map((reason) => <SelectItem key={reason.value} value={reason.value}>{reason.label}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="space-y-2"><Label htmlFor="report-details">补充说明</Label><Textarea id="report-details" rows={5} placeholder="请说明具体位置、上下文或影响。" {...form.register("details")} />{form.formState.errors.details ? <p className="text-xs text-destructive">{form.formState.errors.details.message}</p> : null}</div>
        <div className="flex justify-end gap-2"><Button type="button" variant="ghost" onClick={() => router.back()}>取消</Button><Button type="submit" variant="destructive" disabled={submit.isPending}>{submit.isPending ? "正在提交…" : "提交举报"}</Button></div>
      </form>
    </section>
  );
}
