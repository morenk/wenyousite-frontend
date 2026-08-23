"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { addHours, format } from "date-fns";
import { AlertTriangle, CalendarClock, Radio, UserRoundX } from "lucide-react";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { getApiErrorMessage } from "@/api/errors";
import { useAdminSettings, useUpdateAdminSettings } from "@/api/hooks/use-admin";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const schema = z.object({
  registrationPausedUntil: z.string(),
  contentWritesPausedUntil: z.string(),
  maintenanceTitle: z.string().max(60),
  maintenanceContent: z.string().max(500),
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
      className="w-full space-y-6"
      onSubmit={form.handleSubmit(async (values) => {
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
      })}
    >
      <div className="grid grid-cols-2 gap-5">
        <section className="rounded-2xl border border-border bg-card p-6">
          <div className="flex items-start justify-between gap-4">
            <span className="flex size-10 items-center justify-center rounded-xl bg-warning-soft text-warning"><UserRoundX className="size-5" /></span>
            <Badge tone={registrationPaused ? "warning" : "success"}>{registrationPaused ? "暂停中" : "正常"}</Badge>
          </div>
          <h2 className="mt-5 font-display text-xl font-medium">新用户注册</h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">暂停后，已有用户登录、举报和申诉不受影响。</p>
          <div className="mt-5 space-y-2">
            <Label htmlFor="registration-pause">暂停截止时间</Label>
            <Input id="registration-pause" type="datetime-local" {...form.register("registrationPausedUntil")} />
          </div>
          <div className="mt-3 flex gap-2">
            <Button type="button" size="compact" variant="outline" onClick={() => form.setValue("registrationPausedUntil", localDate(addHours(new Date(), 1)), { shouldDirty: true })}>暂停 1 小时</Button>
            <Button type="button" size="compact" variant="ghost" onClick={() => form.setValue("registrationPausedUntil", "", { shouldDirty: true })}>立即恢复</Button>
          </div>
        </section>

        <section className="rounded-2xl border border-border bg-card p-6">
          <div className="flex items-start justify-between gap-4">
            <span className="flex size-10 items-center justify-center rounded-xl bg-destructive-soft text-destructive"><AlertTriangle className="size-5" /></span>
            <Badge tone={writesPaused ? "danger" : "success"}>{writesPaused ? "只读中" : "正常"}</Badge>
          </div>
          <h2 className="mt-5 font-display text-xl font-medium">社区内容写入</h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">暂停发帖、动态、私聊与上传；举报、申诉和站务入口保持可用。</p>
          <div className="mt-5 space-y-2">
            <Label htmlFor="writes-pause">只读截止时间</Label>
            <Input id="writes-pause" type="datetime-local" {...form.register("contentWritesPausedUntil")} />
          </div>
          <div className="mt-3 flex gap-2">
            <Button type="button" size="compact" variant="outline" onClick={() => form.setValue("contentWritesPausedUntil", localDate(addHours(new Date(), 1)), { shouldDirty: true })}>只读 1 小时</Button>
            <Button type="button" size="compact" variant="ghost" onClick={() => form.setValue("contentWritesPausedUntil", "", { shouldDirty: true })}>立即恢复</Button>
          </div>
        </section>
      </div>

      <section className="rounded-2xl border border-border bg-card p-6">
        <div className="flex items-center gap-3">
          <span className="flex size-10 items-center justify-center rounded-xl bg-info-soft text-info"><CalendarClock className="size-5" /></span>
          <div>
            <h2 className="font-display text-xl font-medium">维护公告窗口</h2>
            <p className="text-sm text-muted-foreground">提前设置公告内容和展示时段，不会自动暂停服务。</p>
          </div>
        </div>
        <div className="mt-6 grid grid-cols-2 gap-5">
          <div className="space-y-2">
            <Label htmlFor="maintenance-title">公告标题</Label>
            <Input id="maintenance-title" placeholder="例如：今晚 23:00 短时维护" {...form.register("maintenanceTitle")} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="maintenance-start">开始</Label>
              <Input id="maintenance-start" type="datetime-local" {...form.register("maintenanceStartsAt")} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="maintenance-end">结束</Label>
              <Input id="maintenance-end" type="datetime-local" {...form.register("maintenanceEndsAt")} />
            </div>
          </div>
          <div className="col-span-2 space-y-2">
            <Label htmlFor="maintenance-content">公告正文</Label>
            <Textarea id="maintenance-content" rows={4} placeholder="说明受影响功能、预计恢复时间和用户需要做什么。" {...form.register("maintenanceContent")} />
          </div>
        </div>
      </section>

      <div className="flex items-center justify-between rounded-xl border border-border bg-card px-5 py-4">
        <p className="flex items-center gap-2 text-xs text-muted-foreground"><Radio className="size-4 text-success" />保存后 5 秒内对所有实例生效，并写入决定轨迹。</p>
        <Button type="submit" disabled={!form.formState.isDirty || update.isPending}>{update.isPending ? "正在应用…" : "保存运行设置"}</Button>
      </div>
    </form>
  );
}
