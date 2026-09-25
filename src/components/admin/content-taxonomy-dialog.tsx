"use client";

import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { getApiError, getApiErrorMessage } from "@/api/errors";
import { type AdminContentDetail, useAdminContentTaxonomy, useAdminTaxonomy } from "@/api/hooks/use-admin";
import { Button } from "@/components/ui/button";
import { Dialog, DialogBackdrop, DialogCloseButton, DialogPopup, DialogPortal, DialogTitle, DialogViewport } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { adminThreadTaxonomySchema } from "@/lib/admin-content-management";

type Values = z.infer<typeof adminThreadTaxonomySchema>;
export function ContentTaxonomyDialog({ item, onClose, reload }: { item: AdminContentDetail; onClose: () => void; reload: () => Promise<AdminContentDetail | undefined> }) {
  const taxonomy = useAdminTaxonomy();
  const mutation = useAdminContentTaxonomy();
  const [version, setVersion] = useState(item.version);
  const [conflict, setConflict] = useState(false);
  const [latest, setLatest] = useState<AdminContentDetail>();
  const [reloading, setReloading] = useState(false);
  const form = useForm<Values>({ resolver: zodResolver(adminThreadTaxonomySchema), defaultValues: { category: item.category ?? "", tagIds: item.tags.map((tag) => tag.id), reason: "" } });
  const category = useWatch({ control: form.control, name: "category" });
  const tagIds = useWatch({ control: form.control, name: "tagIds" });
  const busy = mutation.isPending || reloading;
  return <Dialog open onOpenChange={(open) => { if (!open && !busy) onClose(); }}>
    <DialogPortal><DialogBackdrop /><DialogViewport><DialogPopup data-admin-action-dialog className="max-w-xl p-4">
      <div className="mb-4 flex items-center justify-between gap-3"><DialogTitle>分类与标签</DialogTitle><DialogCloseButton label="关闭分类与标签" disabled={busy} /></div>
      <form className="space-y-4" onSubmit={form.handleSubmit(async (values) => {
        if (version === null || conflict) return;
        try {
          await mutation.mutateAsync({ id: item.id, version, reason: values.reason, category: values.category, tagIds: values.tagIds });
          toast.success("分类与标签已保存");
          onClose();
        } catch (error) {
          const info = getApiError(error);
          const isConflict = info.code === 40002 || info.code === 40900 || info.status === 409;
          setConflict(isConflict);
          form.setError("root", { message: isConflict ? "内容已更新，请读取最新版本后核对并保存。" : getApiErrorMessage(error, "保存失败，请重试") });
        }
      })}>
        {taxonomy.isLoading ? <p role="status" className="text-sm text-muted-foreground">正在读取分类与标签…</p> : null}
        {taxonomy.isError ? <p role="alert" className="text-sm text-destructive">分类与标签读取失败 <Button size="compact" type="button" variant="ghost" onClick={() => void taxonomy.refetch()}>重试</Button></p> : null}
        <div className="space-y-1"><Label>分类</Label>
          <Select value={category} disabled={busy} onValueChange={(value) => form.setValue("category", value ?? "", { shouldValidate: true })}>
            <SelectTrigger aria-label="分类" className="w-full"><SelectValue>{(taxonomy.data?.categories.find((entry) => entry.slug === category)?.name ?? category) || "选择分类"}</SelectValue></SelectTrigger>
            <SelectContent layer="nested">{taxonomy.data?.categories.filter((entry) => entry.isActive || entry.slug === item.category).map((entry) => <SelectItem key={entry.id} value={entry.slug}>{entry.name}{entry.isActive ? "" : "（停用）"}</SelectItem>)}</SelectContent>
          </Select>{form.formState.errors.category ? <p role="alert" className="text-xs text-destructive">{form.formState.errors.category.message}</p> : null}
        </div>
        <div className="space-y-1"><Label>标签</Label>
          <Select multiple value={tagIds} disabled={busy} onValueChange={(value) => form.setValue("tagIds", value, { shouldValidate: true })}>
            <SelectTrigger aria-label="标签" className="w-full"><SelectValue>{tagIds.length ? tagIds.map((id) => taxonomy.data?.tags.find((tag) => tag.id === id)?.name ?? item.tags.find((tag) => tag.id === id)?.name ?? id).join("、") : "选择标签"}</SelectValue></SelectTrigger>
            <SelectContent layer="nested">{taxonomy.data?.tags.filter((entry) => entry.isActive || item.tags.some((tag) => tag.id === entry.id)).map((entry) => <SelectItem key={entry.id} value={entry.id} disabled={!tagIds.includes(entry.id) && tagIds.length >= 5}>{entry.name}{entry.isActive ? "" : "（停用）"}</SelectItem>)}</SelectContent>
          </Select>{form.formState.errors.tagIds ? <p role="alert" className="text-xs text-destructive">{form.formState.errors.tagIds.message}</p> : null}
        </div>
        <div className="space-y-1"><Label htmlFor="taxonomy-reason">理由</Label><Textarea id="taxonomy-reason" rows={3} disabled={busy} {...form.register("reason")} />{form.formState.errors.reason ? <p role="alert" className="text-xs text-destructive">{form.formState.errors.reason.message}</p> : null}</div>
        {form.formState.errors.root ? <p role="alert" className="text-sm text-destructive">{form.formState.errors.root.message}</p> : null}
        {latest ? <div className="rounded-[var(--radius-compact)] border border-border bg-muted p-3 text-sm" aria-label="最新分类与标签"><p>当前分类：{taxonomy.data?.categories.find((entry) => entry.slug === latest.category)?.name ?? latest.category}</p><p>当前标签：{latest.tags.map((tag) => tag.name).join("、") || "无"}</p></div> : null}
        <div className="flex justify-end gap-2">
          {conflict ? <Button type="button" variant="outline" size="compact" disabled={busy} onClick={async () => { setReloading(true); try { const fresh = await reload(); if (fresh) { setLatest(fresh); setVersion(fresh.version); setConflict(false); form.clearErrors("root"); } else form.setError("root", { message: "读取失败，请重试" }); } finally { setReloading(false); } }}>读取最新版本</Button> : null}
          <Button type="button" variant="ghost" size="compact" disabled={busy} onClick={onClose}>取消</Button>
          <Button type="submit" size="compact" disabled={busy || conflict || !taxonomy.data || version === null}>保存</Button>
        </div>
      </form>
    </DialogPopup></DialogViewport></DialogPortal>
  </Dialog>;
}
