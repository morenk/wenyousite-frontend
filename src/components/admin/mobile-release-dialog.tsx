"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRef, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import { getApiError, getApiErrorMessage } from "@/api/errors";
import { type AdminMobileRelease, useAdminMobileRelease, useAdminMobileReleaseActions, useAdminSession } from "@/api/hooks/use-admin";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogBackdrop, DialogCloseButton, DialogPopup, DialogPortal, DialogTitle, DialogViewport } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { mobileReleaseFormSchema, releaseNotesLines, type MobileReleaseFormValues } from "@/lib/mobile-release-form";
import { MobileReleaseNotesFields } from "./mobile-release-notes-fields";
import { MobileReleaseNotesPreview } from "./mobile-release-notes-preview";

export const mobileReleaseStatusLabels = { DRAFT: "草稿", READY: "待发布", PUBLISHED: "已发布" } as const;

function valuesOf(record?: AdminMobileRelease): MobileReleaseFormValues {
  return { versionName: record?.versionName ?? "", buildNumber: record?.buildNumber ?? NaN, summary: record?.summary ?? "", itemsText: record?.items.join("\n") ?? "" };
}

export function MobileReleaseDialog({ id, onClose, onCreated }: { id?: string; onClose: () => void; onCreated: (id: string) => void }) {
  const detail = useAdminMobileRelease(id);
  const [busy, setBusy] = useState(false);
  return <Dialog open onOpenChange={(open) => { if (!open && !busy) onClose(); }}>
    <DialogPortal><DialogBackdrop /><DialogViewport><DialogPopup data-admin-action-dialog className="max-w-3xl">
      <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
        <DialogTitle>{id ? "版本说明" : "新建版本说明"}</DialogTitle>
        <DialogCloseButton label="关闭版本说明" disabled={busy} />
      </div>
      {id && !detail.data ? (
        <div className="p-4">
          {detail.isError ? <div role="alert" className="space-y-2 text-sm text-destructive"><p>版本说明读取失败</p><Button type="button" variant="outline" disabled={detail.isFetching} onClick={() => void detail.refetch()}>重试</Button></div> : <p role="status" className="text-sm text-muted-foreground">正在读取版本说明…</p>}
        </div>
      ) : <MobileReleaseEditor
        key={id ?? "new"} record={detail.data} readFailed={Boolean(id && detail.isError)}
        onBusy={setBusy} onCreated={onCreated}
        reload={async () => { const result = await detail.refetch(); if (result.isError) throw result.error; return result.data!; }}
      />}
    </DialogPopup></DialogViewport></DialogPortal>
  </Dialog>;
}

function MobileReleaseEditor({ record, readFailed, onBusy, onCreated, reload }: {
  record?: AdminMobileRelease;
  readFailed: boolean;
  onBusy: (busy: boolean) => void;
  onCreated: (id: string) => void;
  reload: () => Promise<AdminMobileRelease>;
}) {
  const session = useAdminSession();
  const actions = useAdminMobileReleaseActions();
  const [base, setBase] = useState(record);
  const [conflict, setConflict] = useState(false);
  const [comparison, setComparison] = useState<AdminMobileRelease>();
  const [reloading, setReloading] = useState(false);
  const inFlight = useRef(false);
  const form = useForm<MobileReleaseFormValues>({ resolver: zodResolver(mobileReleaseFormSchema), defaultValues: valuesOf(record) });
  const [version, build] = useWatch({ control: form.control, name: ["versionName", "buildNumber"] });
  const superAdmin = session.data?.user.role === "SUPER_ADMIN";
  const authenticated = session.sessionStatus === "authenticated";
  const published = Boolean(record?.published);
  const busy = actions.create.isPending || actions.update.isPending || actions.confirm.isPending || form.formState.isSubmitting || reloading;
  const stale = conflict || Boolean(base && record && (
    base.revision !== record.revision || base.confirmed?.revision !== record.confirmed?.revision ||
    base.published?.revision !== record.published?.revision || base.publishing !== record.publishing
  ));
  const canEdit = authenticated && !record?.publishing && (!published || superAdmin);
  const locked = busy || !canEdit;
  const identityMismatch = Boolean(record?.confirmed && version !== record.versionName);
  const identity = { platform: "Android", version: version ?? "", build: Number.isFinite(build) ? build : "" };
  const serverIdentity = { platform: "Android", version: record?.versionName ?? "", build: record?.buildNumber ?? "" };

  function showError(error: unknown) {
    const info = getApiError(error);
    if (info.code === 40900 || info.status === 409) {
      if (base) {
        setConflict(true);
        form.setError("root", { message: "版本说明已变化或正在发布。输入已保留，请读取最新内容后核对。" });
      } else {
        form.setError("buildNumber", { message: "此平台与构建号可能已存在，请刷新列表核对后再创建。" });
      }
      return;
    }
    const message = getApiErrorMessage(error, "操作失败，请重试");
    const field = info.code === 40001 ? message.match(/^(versionName|buildNumber|summary|items)(?:\b|\.)/)?.[1] : undefined;
    if (field) form.setError(field === "items" ? "itemsText" : field as "versionName" | "buildNumber" | "summary", { message });
    else form.setError("root", { message });
  }

  async function save(values: MobileReleaseFormValues) {
    if (inFlight.current || !canEdit || stale || readFailed || identityMismatch) return;
    inFlight.current = true; onBusy(true); form.clearErrors();
    try {
      const content = { summary: values.summary, items: releaseNotesLines(values.itemsText) };
      if (base) {
        const saved = await actions.update.mutateAsync({ id: base.id, revision: base.revision, ...content, ...(!record?.confirmed ? { versionName: values.versionName } : {}) });
        setBase(saved); setComparison(undefined); form.reset(valuesOf(saved));
        toast.success("草稿已保存");
      } else {
        const saved = await actions.create.mutateAsync({ platform: "android", versionName: values.versionName, buildNumber: values.buildNumber, ...content });
        toast.success("版本说明草稿已创建"); onCreated(saved.id);
      }
    } catch (error) { showError(error); }
    finally { inFlight.current = false; onBusy(false); }
  }

  async function confirm() {
    if (inFlight.current || !base || !canEdit || !superAdmin || stale || readFailed || identityMismatch || form.formState.isDirty || !record?.hasUnconfirmedChanges) return;
    inFlight.current = true; onBusy(true); form.clearErrors();
    try {
      const saved = await actions.confirm.mutateAsync({ id: base.id, revision: base.revision });
      setBase(saved); setComparison(undefined); form.reset(valuesOf(saved));
      toast.success(saved.published ? "公开说明已更新" : "说明已确认，等待发版");
    } catch (error) { showError(error); }
    finally { inFlight.current = false; onBusy(false); }
  }

  return <form className="space-y-4 p-4" onSubmit={(event) => void form.handleSubmit(save)(event)}>
    <div className="flex flex-wrap items-center gap-2 text-sm">
      <Badge tone={published ? "success" : "neutral"}>{record ? mobileReleaseStatusLabels[record.status] : "草稿"}</Badge>
      {record?.hasUnconfirmedChanges && record.confirmed ? <Badge tone="warning">待修订确认</Badge> : null}
      {record ? <span className="text-xs text-muted-foreground">修订 {record.revision}{record.confirmed ? ` · 已确认修订 ${record.confirmed.revision}` : " · 尚未确认"}</span> : null}
      {record?.publishing ? <span role="status">版本正在发布，暂不可修改或确认</span> : null}
    </div>
    <div className="grid grid-cols-[1fr_1fr] gap-3">
      <div className="space-y-1"><Label htmlFor="release-version">Android 版本名</Label><Input id="release-version" readOnly={Boolean(record?.confirmed)} disabled={locked} aria-invalid={Boolean(form.formState.errors.versionName)} aria-describedby={form.formState.errors.versionName ? "release-version-error" : undefined} {...form.register("versionName")} />{form.formState.errors.versionName ? <p id="release-version-error" role="alert" className="text-xs text-destructive">{form.formState.errors.versionName.message}</p> : null}</div>
      <div className="space-y-1"><Label htmlFor="release-build">构建号</Label><Input id="release-build" type="number" min={1} max={2100000000} readOnly={Boolean(record)} disabled={locked} aria-invalid={Boolean(form.formState.errors.buildNumber)} aria-describedby={form.formState.errors.buildNumber ? "release-build-error" : undefined} {...form.register("buildNumber", { valueAsNumber: true })} />{form.formState.errors.buildNumber ? <p id="release-build-error" role="alert" className="text-xs text-destructive">{form.formState.errors.buildNumber.message}</p> : null}</div>
    </div>
    {identityMismatch ? <div className="space-y-2 text-sm"><p role="alert">版本名已由其他管理员确认。你填写的版本名仍保留，请采用已确认版本名后继续；摘要和条目保持不变。</p><Button type="button" variant="outline" size="compact" disabled={busy || !authenticated} onClick={() => form.setValue("versionName", record!.versionName, { shouldDirty: true, shouldValidate: true })}>采用已确认版本名 {record?.versionName}</Button></div> : null}
    {published ? <p className="text-sm text-muted-foreground">用户继续看到下方的当前公开说明。修正保存为草稿，超级管理员确认后才替换公开内容。</p> : <p className="text-sm text-muted-foreground">草稿与待发布说明仅后台可见。确认说明后等待发版，此处操作不会发布安装包。</p>}
    {!canEdit && published && !superAdmin ? <p className="text-sm text-muted-foreground">已发布说明仅超级管理员可修正。</p> : null}
    <MobileReleaseNotesFields form={form} identity={identity} disabled={locked} />
    {form.formState.errors.root ? <p role="alert" className="text-sm text-destructive">{form.formState.errors.root.message}</p> : null}
    {(stale || readFailed) ? <div className="space-y-2 rounded-[var(--radius-card)] border border-border bg-muted p-3">
      <p role="alert" className="text-sm">{readFailed ? "最新状态读取失败，输入已保留。" : "请先读取最新内容并核对，你的输入会保留。"}</p>
      <Button type="button" variant="outline" size="compact" disabled={busy || !authenticated} onClick={async () => {
        if (inFlight.current) return;
        inFlight.current = true; setReloading(true); onBusy(true);
        try { const fresh = await reload(); setComparison(fresh); setBase(fresh); setConflict(false); form.clearErrors("root"); }
        catch (error) { form.setError("root", { message: getApiErrorMessage(error, "读取失败，请重试") }); }
        finally { inFlight.current = false; setReloading(false); onBusy(false); }
      }}>读取最新内容</Button>
    </div> : null}
    {comparison ? <MobileReleaseNotesPreview title="最新服务端草稿（输入已保留，请核对）" identity={{ platform: "Android", version: comparison.versionName, build: comparison.buildNumber }} summary={comparison.summary} items={comparison.items} /> : null}
    {record?.confirmed && record.confirmed.revision !== record.published?.revision ? <MobileReleaseNotesPreview title="已确认说明" identity={serverIdentity} summary={record.confirmed.summary} items={record.confirmed.items} /> : null}
    {record?.published ? <MobileReleaseNotesPreview title="当前公开说明" identity={{ platform: "Android", version: record.published.versionName, build: record.published.buildNumber }} summary={record.published.summary} items={record.published.items} /> : null}
    {record && superAdmin && form.formState.isDirty ? <p className="text-sm text-muted-foreground">请先保存草稿，再确认说明。</p> : null}
    <div className="flex flex-wrap justify-end gap-2 border-t border-border pt-3">
      {canEdit ? <Button type="submit" variant="outline" disabled={busy || stale || readFailed || identityMismatch || Boolean(record && !form.formState.isDirty)}>{busy ? "处理中…" : "保存草稿"}</Button> : null}
      {record && superAdmin ? <Button type="button" disabled={busy || !canEdit || stale || readFailed || identityMismatch || form.formState.isDirty || !record.hasUnconfirmedChanges} onClick={() => void confirm()}>{published ? "确认修正并更新公开说明" : "确认说明"}</Button> : null}
    </div>
  </form>;
}
