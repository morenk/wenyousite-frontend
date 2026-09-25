"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { z } from "zod";
import { type AdminContentDetail, useAdminContentActions, useAdminContentDetail, useAdminTaxonomy } from "@/api/hooks/use-admin";
import type { AdminContentType } from "@/api/admin-types";
import { getApiErrorMessage } from "@/api/errors";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Dialog, DialogBackdrop, DialogCloseButton, DialogPopup, DialogPortal, DialogTitle, DialogViewport } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { InternalReferenceText } from "@/components/shared/internal-reference-text";
import { MarkdownContent } from "@/components/thread/markdown-content";
import { WenyouTime } from "@/components/shared/wenyou-time";
import { adminAttachedMedia } from "@/lib/admin-content-management";
import { safeAdminReturnTo } from "@/hooks/use-admin-list-return";
import { ContentTaxonomyDialog } from "./content-taxonomy-dialog";
import { actionLabels } from "./audit-panel";
import { AdminTable, AdminTableBody, AdminTableCell, AdminTableHead, AdminTableHeader, AdminTableRow } from "./admin-table";

export const reasonSchema = z.object({ reason: z.string().trim().min(1, "请填写理由").refine((value) => Array.from(value).length <= 500, "理由最多 500 个字") });

export function ContentDetailPanel({ type, id }: { type: AdminContentType; id: string }) {
  const params = useSearchParams();
  const detail = useAdminContentDetail(type, id);
  const taxonomy = useAdminTaxonomy();
  const [taxonomyOpen, setTaxonomyOpen] = useState(false);
  const [actionOpen, setActionOpen] = useState(false);
  const item = detail.isError ? undefined : detail.data;
  const returnTo = safeAdminReturnTo(params.get("returnTo"), "/station/content");
  const parentHref = (parentType: AdminContentType, parentId: string) => `/station/content/${parentType}/${parentId}?returnTo=${encodeURIComponent(returnTo)}`;
  return <div className="space-y-4">
    <div className="flex items-center justify-between gap-3">
      <Link href={returnTo} className={buttonVariants({ variant: "outline", size: "compact" })}>返回内容列表</Link>
      {item ? <div className="flex gap-2">{type === "thread" ? <Button size="compact" variant="outline" onClick={() => setTaxonomyOpen(true)}>分类与标签</Button> : null}<Button size="compact" variant={item.hidden ? "outline" : "destructive"} disabled={item.hidden && !item.canRestore} onClick={() => setActionOpen(true)}>{item.hidden ? "恢复" : "隐藏"}</Button></div> : null}
    </div>
    {detail.isLoading ? <p role="status" className="text-sm text-muted-foreground">正在读取内容…</p> : null}
    {detail.isError ? <p role="alert" className="text-sm text-destructive">内容不存在或无法查看 <Button size="compact" variant="ghost" onClick={() => void detail.refetch()}>重试</Button></p> : null}
    {item ? <>
      <section className="rounded-[var(--radius-card)] border border-border bg-card p-4">
        {item.title ? <h2 className="mb-3 break-words text-lg font-semibold">{item.title}</h2> : null}
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
          <Link href={`/station/users/${item.author.id}?returnTo=${encodeURIComponent(returnTo)}`} className="font-semibold hover:underline">{item.author.username}</Link>
          <span className="text-muted-foreground">创建于 <WenyouTime value={item.createdAt} /></span>
          <Badge tone={item.hidden ? "warning" : "success"}>{item.hidden ? "已隐藏" : "正常"}</Badge>
          {item.parentHidden ? <Badge tone="neutral">父级已隐藏</Badge> : null}
          {item.category ? <span>{taxonomy.data?.categories.find((entry) => entry.slug === item.category)?.name ?? item.category}</span> : null}
          {item.tags.map((tag) => <span key={tag.id} className="text-muted-foreground">#{tag.name}{tag.isActive ? "" : "（停用）"}</span>)}
        </div>
        <dl className="mt-3 flex flex-wrap gap-x-5 gap-y-2 border-t border-border pt-3 text-xs text-muted-foreground"><div className="flex gap-2"><dt>内容编号</dt><dd>{item.id}</dd></div>{item.threadId && item.type !== "thread" ? <div><Link href={parentHref("thread", item.threadId)} className="hover:underline">所属主题帖</Link></div> : null}{item.momentId && item.type !== "moment" ? <div><Link href={parentHref("moment", item.momentId)} className="hover:underline">所属动态</Link></div> : null}{item.parentPostId ? <div><Link href={parentHref("post", item.parentPostId)} className="hover:underline">上级楼层</Link></div> : null}{item.parentCommentId ? <div><Link href={parentHref("moment_comment", item.parentCommentId)} className="hover:underline">上级评论</Link></div> : null}</dl>
        {item.hidden && !item.canRestore ? <p role="status" className="mt-3 text-sm text-warning">{item.restoreBlockedReason || "父级不可见，暂时无法恢复。"}</p> : null}
        <div className="mt-4 border-t border-border pt-4">
          {item.content ? item.type === "moment" || item.type === "moment_comment" ? <p className="whitespace-pre-wrap break-words text-sm leading-6"><InternalReferenceText content={item.content} /></p> : <MarkdownContent content={item.content} size="compact" mediaDisplays={item.media.filter((media) => media.display !== null).map((media) => ({ sourceUrl: media.url, display: media.display! }))} /> : <p className="text-sm text-muted-foreground">无文字内容</p>}
          {adminAttachedMedia(item.type, item.content, item.media).map((media, index) => <div key={media.id} className="mt-3 max-w-2xl"><MarkdownContent size="compact" content={`![附件 ${index + 1}](${media.url})`} mediaDisplays={media.display ? [{ sourceUrl: media.url, display: media.display }] : []} /></div>)}
        </div>
      </section>
      <section className="overflow-hidden rounded-[var(--radius-card)] border border-border bg-card">
        <div className="flex items-center justify-between px-3 py-2"><h2 className="text-base font-semibold">操作记录</h2><Link href={`/station/audit?target=${type.toUpperCase()}&id=${encodeURIComponent(id)}`} className={buttonVariants({ variant: "ghost", size: "compact" })}>全部记录</Link></div>
        <AdminTable aria-label="内容操作记录"><AdminTableHead><tr><AdminTableHeader>操作</AdminTableHeader><AdminTableHeader>操作人</AdminTableHeader><AdminTableHeader>理由</AdminTableHeader><AdminTableHeader>时间</AdminTableHeader></tr></AdminTableHead><AdminTableBody>{item.auditLogs.map((log) => <AdminTableRow key={log.id}><AdminTableCell>{actionLabels[log.action] ?? "内容操作"}</AdminTableCell><AdminTableCell>{log.actor?.username ?? "系统"}</AdminTableCell><AdminTableCell>{log.reason ?? "—"}</AdminTableCell><AdminTableCell><WenyouTime mode="exact" value={log.createdAt} /></AdminTableCell></AdminTableRow>)}{!item.auditLogs.length ? <AdminTableRow><AdminTableCell colSpan={4} className="text-muted-foreground">暂无记录</AdminTableCell></AdminTableRow> : null}</AdminTableBody></AdminTable>
      </section>
      {taxonomyOpen ? <ContentTaxonomyDialog item={item} onClose={() => setTaxonomyOpen(false)} reload={async () => { const fresh = await detail.refetch(); return fresh.isError ? undefined : fresh.data; }} /> : null}
      {actionOpen ? <ContentStateDialog item={item} onClose={() => setActionOpen(false)} /> : null}
    </> : null}
  </div>;
}

function ContentStateDialog({ item, onClose }: { item: AdminContentDetail; onClose: () => void }) {
  const actions = useAdminContentActions();
  const mutation = item.hidden ? actions.restore : actions.hide;
  const form = useForm<z.infer<typeof reasonSchema>>({ resolver: zodResolver(reasonSchema), defaultValues: { reason: "" } });
  const label = item.hidden ? "恢复" : "隐藏";
  return <Dialog open onOpenChange={(open) => { if (!open && !mutation.isPending) onClose(); }}><DialogPortal><DialogBackdrop /><DialogViewport><DialogPopup data-admin-action-dialog className="max-w-xl p-4">
    <div className="mb-4 flex items-center justify-between"><DialogTitle>{label}内容</DialogTitle><DialogCloseButton label="关闭内容操作" disabled={mutation.isPending} /></div>
    <form className="space-y-3" onSubmit={form.handleSubmit(async ({ reason }) => { try { await mutation.mutateAsync({ type: item.type, id: item.id, reason }); toast.success(`内容已${label}`); onClose(); } catch (error) { form.setError("root", { message: getApiErrorMessage(error, `${label}失败，请重试`) }); } })}>
      <Label htmlFor="content-state-reason">理由</Label><Textarea id="content-state-reason" rows={3} {...form.register("reason")} />
      {form.formState.errors.reason ? <p role="alert" className="text-xs text-destructive">{form.formState.errors.reason.message}</p> : null}
      {form.formState.errors.root ? <p role="alert" className="text-sm text-destructive">{form.formState.errors.root.message}</p> : null}
      <div className="flex items-center justify-between gap-3"><p className="text-xs text-muted-foreground">{item.hidden ? "恢复后公开可见。" : "内容将立即隐藏，保留原内容及操作记录。"}</p><Button type="submit" size="compact" variant={item.hidden ? "default" : "destructive"} disabled={mutation.isPending}>确认{label}</Button></div>
    </form>
  </DialogPopup></DialogViewport></DialogPortal></Dialog>;
}
