"use client";

import { useSubmissionLock } from "@/hooks/use-submission-lock";
import { zodResolver } from "@hookform/resolvers/zod";
import { addHours, format } from "date-fns";
import { AlertTriangle, CalendarClock, UserRoundX } from "lucide-react";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { getApiErrorMessage } from "@/api/errors";
import { useAdminSettings, useUpdateAdminSettings } from "@/api/hooks/use-admin";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/ui/form-field";
import { Textarea } from "@/components/ui/textarea";

export const schema = z.object({
  registrationPausedUntil: z.string(),
  contentWritesPausedUntil: z.string(),
  maintenanceTitle: z.string().refine((value) => Array.from(value).length <= 60, "最多 60 个字符"),
  maintenanceContent: z.string().refine((value) => Array.from(value).length <= 500, "最多 500 个字符"),
  maintenanceStartsAt: z.string(),
  maintenanceEndsAt: z.string(),
});

type Values = z.infer<typeof schema>;

function localDate(value?: string | Date | null) {
  return value ? format(new Date(value), "yyyy-MM-dd'T'HH:mm") : "";
}

function isoOrNull(value: string) {
  return value ? new Date(value).toISOString() : null;
}

export function OperationsSettingsPanel() {
  const settings = useAdminSettings();
  const update = useUpdateAdminSettings();
  const submission = useSubmissionLock();
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      registrationPausedUntil: "",
      contentWritesPausedUntil: "",
      maintenanceTitle: "",
      maintenanceContent: "",
      maintenanceStartsAt: "",
      maintenanceEndsAt: "",
    },
  });

  useEffect(() => {
    if (!settings.data) return;
    form.reset({
      registrationPausedUntil: localDate(settings.data.registrationPausedUntil),
      contentWritesPausedUntil: localDate(settings.data.contentWritesPausedUntil),
      maintenanceTitle: settings.data.maintenanceTitle ?? "",
      maintenanceContent: settings.data.maintenanceContent ?? "",
      maintenanceStartsAt: localDate(settings.data.maintenanceStartsAt),
      maintenanceEndsAt: localDate(settings.data.maintenanceEndsAt),
    });
  }, [form, settings.data]);

  if (settings.isLoading) return <p className="text-sm text-muted-foreground">正在读取运行设置…</p>;
  if (settings.isError) return <p className="text-sm text-destructive">运行设置加载失败</p>;

  const registrationPaused = Boolean(
    settings.data?.registrationPausedUntil && new Date(settings.data.registrationPausedUntil) > new Date(),
  );
  const writesPaused = Boolean(
    settings.data?.contentWritesPausedUntil && new Date(settings.data.contentWritesPausedUntil) > new Date(),
  );

  return (
    <form
      data-slot="admin-operations-workspace"
      className="w-full space-y-4"
      onSubmit={form.handleSubmit(submission.guard(async (values) => {
        try {
          await update.mutateAsync({
            registrationPausedUntil: isoOrNull(values.registrationPausedUntil),
            contentWritesPausedUntil: isoOrNull(values.contentWritesPausedUntil),
            maintenanceTitle: values.maintenanceTitle.trim() || null,
            maintenanceContent: values.maintenanceContent.trim() || null,
            maintenanceStartsAt: isoOrNull(values.maintenanceStartsAt),
            maintenanceEndsAt: isoOrNull(values.maintenanceEndsAt),
          });
          toast.success("运行设置已更新");
        } catch (error) {
          toast.error(getApiErrorMessage(error, "运行设置保存失败"));
        }
      }))}
    >
      <div className="grid grid-cols-2 gap-5">
        <section className="rounded-[var(--radius-card)] border border-border bg-card p-4">
          <div className="flex items-start justify-between gap-4">
            <span className="flex size-10 items-center justify-center rounded-full bg-warning-soft text-warning"><UserRoundX className="size-5" /></span>
            <Badge tone={registrationPaused ? "warning" : "success"}>{registrationPaused ? "暂停中" : "正常"}</Badge>
          </div>
          <h2 className="mt-5 font-sans text-xl font-semibold">新用户注册</h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">暂停后，已有用户登录、举报和申诉不受影响。</p>
          <FormField id="registration-pause" label="暂停截止时间" error={form.formState.errors.registrationPausedUntil?.message} className="mt-5">
            {(controlProps) => <Input {...controlProps} type="datetime-local" {...form.register("registrationPausedUntil")} />}
          </FormField>
          <div className="mt-3 flex gap-2">
            <Button type="button" size="compact" variant="outline" onClick={() => form.setValue("registrationPausedUntil", localDate(addHours(new Date(), 1)), { shouldDirty: true })}>暂停 1 小时</Button>
            <Button type="button" size="compact" variant="ghost" onClick={() => form.setValue("registrationPausedUntil", "", { shouldDirty: true })}>立即恢复</Button>
          </div>
        </section>

        <section className="rounded-[var(--radius-card)] border border-border bg-card p-4">
          <div className="flex items-start justify-between gap-4">
            <span className="flex size-10 items-center justify-center rounded-full bg-destructive-soft text-destructive"><AlertTriangle className="size-5" /></span>
            <Badge tone={writesPaused ? "danger" : "success"}>{writesPaused ? "只读中" : "正常"}</Badge>
          </div>
          <h2 className="mt-5 font-sans text-xl font-semibold">社区内容写入</h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">暂停发帖、动态、私聊与上传；举报、申诉和站务入口保持可用。</p>
          <FormField id="writes-pause" label="只读截止时间" error={form.formState.errors.contentWritesPausedUntil?.message} className="mt-5">
            {(controlProps) => <Input {...controlProps} type="datetime-local" {...form.register("contentWritesPausedUntil")} />}
          </FormField>
          <div className="mt-3 flex gap-2">
            <Button type="button" size="compact" variant="outline" onClick={() => form.setValue("contentWritesPausedUntil", localDate(addHours(new Date(), 1)), { shouldDirty: true })}>只读 1 小时</Button>
            <Button type="button" size="compact" variant="ghost" onClick={() => form.setValue("contentWritesPausedUntil", "", { shouldDirty: true })}>立即恢复</Button>
          </div>
        </section>
      </div>

      <section className="rounded-[var(--radius-card)] border border-border bg-card p-4">
        <div className="flex items-center gap-3">
          <span className="flex size-10 items-center justify-center rounded-full bg-info-soft text-info"><CalendarClock className="size-5" /></span>
          <div>
            <h2 className="font-sans text-xl font-semibold">维护公告窗口</h2>

          </div>
        </div>
        <div className="mt-6 grid grid-cols-2 gap-5">
          <FormField id="maintenance-title" label="公告标题" error={form.formState.errors.maintenanceTitle?.message}>
            {(controlProps) => <Input {...controlProps} placeholder="例如：今晚 23:00 短时维护" {...form.register("maintenanceTitle")} />}
          </FormField>
          <div className="grid grid-cols-2 gap-3">
            <FormField id="maintenance-start" label="开始" error={form.formState.errors.maintenanceStartsAt?.message}>
              {(controlProps) => <Input {...controlProps} type="datetime-local" {...form.register("maintenanceStartsAt")} />}
            </FormField>
            <FormField id="maintenance-end" label="结束" error={form.formState.errors.maintenanceEndsAt?.message}>
              {(controlProps) => <Input {...controlProps} type="datetime-local" {...form.register("maintenanceEndsAt")} />}
            </FormField>
          </div>
          <FormField id="maintenance-content" label="公告正文" error={form.formState.errors.maintenanceContent?.message} className="col-span-2">
            {(controlProps) => <Textarea {...controlProps} rows={4} placeholder="说明受影响功能、预计恢复时间和用户需要做什么。" {...form.register("maintenanceContent")} />}
          </FormField>
        </div>
      </section>

      <div className="flex items-center justify-between rounded-[var(--radius-card)] border border-border bg-card px-5 py-4">

        <Button type="submit" disabled={!form.formState.isDirty} pending={submission.pending || form.formState.isSubmitting || update.isPending} pendingLabel="正在应用…">保存运行设置</Button>
      </div>
    </form>
  );
}
