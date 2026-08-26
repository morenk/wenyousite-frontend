"use client";

import Link from "next/link";
import { CONTENT_PRESENTATION } from "@wenyousite/foundation/collections";
import { useRouter } from "next/navigation";
import { Pencil, Save, ShieldAlert, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useDeleteMoment, useMoment, useMomentBookmark, useMomentLike, useUpdateMoment } from "@/api/hooks/use-moments";
import { getApiErrorMessage, isContentUnavailableError } from "@/api/errors";
import { useContentAccessCache } from "@/api/hooks/use-content-access-cache";
import { MomentComments } from "@/components/moment/moment-comments";
import { MomentImageGallery } from "@/components/moment/moment-image-gallery";
import { WenyouTipButton } from "@/components/economy/wenyou-tip-button";
import {
  InternalReferenceEditor,
  type InternalReferenceEditorHandle,
} from "@/components/shared/internal-reference-editor";
import { InternalReferenceInsert } from "@/components/shared/internal-reference-insert";
import { InternalReferenceText } from "@/components/shared/internal-reference-text";
import { LoadError } from "@/components/shared/load-error";
import { UserAvatar } from "@/components/shared/user-avatar";
import { WenyouTime } from "@/components/shared/wenyou-time";
import { WenyouCount } from "@/components/shared/wenyou-count";
import { Button } from "@/components/ui/button";
import { InteractionToggle } from "@/components/ui/interaction-toggle";
import { Input } from "@/components/ui/input";
import { Tooltip } from "@/components/ui/tooltip";
import { useConfirm } from "@/components/ui/confirm-provider";
import { useAuth } from "@/lib/auth";
import { AdminContentModerationDialog } from "@/components/admin/admin-content-moderation-dialog";
import { PageRouteFallback } from "@/components/layout/page-route-fallback";
import { BookmarkFolderPickerDialog } from "@/components/user/bookmark-folder-picker-dialog";
import { usePublicInviteConfirmation } from "@/components/shared/use-public-invite-confirmation";
import { useLoginRedirect } from "@/hooks/use-login-redirect";

export function MomentDetailView({ momentId, onDeleted }: { momentId: string; onDeleted?: () => void }) {
  const { user } = useAuth();
  const router = useRouter();
  const { clearMoment } = useContentAccessCache();
  const redirectToLogin = useLoginRedirect();
  const detail = useMoment(momentId, user?.id);
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editContent, setEditContent] = useState("");
  const [moderationOpen, setModerationOpen] = useState(false);
  const [bookmarkPickerOpen, setBookmarkPickerOpen] = useState(false);
  const editContentRef = useRef<InternalReferenceEditorHandle>(null);
  const confirm = useConfirm();
  const { confirmPublicInvite, resetPublicInviteConfirmation } = usePublicInviteConfirmation();
  const remove = useDeleteMoment();
  const update = useUpdateMoment();
  const moment = detail.data;
  const like = useMomentLike(momentId, moment?.viewerLiked ?? false);
  const bookmark = useMomentBookmark(momentId, moment?.viewerBookmarked ?? false);
  const canModerate = user?.role === "ADMIN" || user?.role === "SUPER_ADMIN";

  const unavailable = isContentUnavailableError(detail.error);

  useEffect(() => {
    if (!unavailable) return;
    clearMoment(momentId, { preserveActive: true });
  }, [clearMoment, momentId, unavailable]);

  const awaitingValidation = detail.isFetching && !detail.isFetchedAfterMount;
  if (detail.isLoading || awaitingValidation) {
    return <PageRouteFallback variant="detail" />;
  }
  if (detail.isError || !moment) {
    return (
      <LoadError
        title="动态不存在"
        description="它可能已被删除，或当前不可见。"
        onRetry={unavailable ? undefined : () => void detail.refetch()}
        className="py-24"
      />
    );
  }

  const canAddInteraction = moment.canInteract !== false;
  const canToggleLike = canAddInteraction || moment.viewerLiked;
  const canToggleBookmark = canAddInteraction || moment.viewerBookmarked;

  const requireLogin = () => {
    if (user) return true;
    redirectToLogin();
    return false;
  };
  const toggleLike = async () => {
    if (!canToggleLike || like.isPending || !requireLogin()) return;
    try { await like.mutateAsync(); } catch (error) { toast.error(getApiErrorMessage(error, "点赞失败")); }
  };
  const toggleBookmark = async () => {
    if (!canToggleBookmark || !requireLogin()) return;
    if (!moment.viewerBookmarked) {
      setBookmarkPickerOpen(true);
      return;
    }
    try { await bookmark.mutateAsync(undefined); } catch (error) { toast.error(getApiErrorMessage(error, "收藏失败")); }
  };
  const deleteMoment = async () => {
    const accepted = await confirm({ title: "删除这条动态？", description: "删除后不会再出现在动态区，操作无法撤销。", confirmLabel: "删除", destructive: true });
    if (!accepted) return;
    try {
      await remove.mutateAsync(moment.id);
      toast.success("动态已删除");
      if (onDeleted) onDeleted();
      else router.replace("/moments");
    } catch (error) {
      toast.error(getApiErrorMessage(error, "删除失败"));
    }
  };
  const startEditing = () => {
    setEditTitle(moment.title);
    setEditContent(moment.content);
    setEditing(true);
  };
  const saveEdit = async () => {
    const title = editTitle.trim();
    if (Array.from(title).length < 2 || Array.from(title).length > 40) {
      toast.error("标题需要 2～40 个字");
      return;
    }
    if (Array.from(editContent).length > 1000) {
      toast.error("正文最多 1000 个字");
      return;
    }
    if (!(await confirmPublicInvite(editContent))) return;
    try {
      await update.mutateAsync({
        id: moment.id,
        body: { title, content: editContent, version: moment.version },
      });
      resetPublicInviteConfirmation();
      setEditing(false);
      toast.success("动态已更新");
    } catch (error) {
      toast.error(getApiErrorMessage(error, "编辑失败，请刷新后重试"));
    }
  };
  const insertEditReference = (markdown: string) => {
    editContentRef.current?.insertReference(markdown);
  };
  return (
    <>
      <article
        className="w-full bg-background"
        data-content-purpose={CONTENT_PRESENTATION.detail.purpose}
        data-content-surface={CONTENT_PRESENTATION.detail.surface}
      >
      <section
        data-slot="moment-detail-title-card"
        className="mb-3 w-full rounded-2xl bg-muted/35 px-5 py-4 sm:px-7"
        aria-label="动态标题与作者"
      >
        <header data-slot="moment-detail-header" className="flex items-center gap-3">
          <Link href={`/users/${moment.author.id}`} className="flex min-w-0 items-center gap-3 rounded-xl">
            <UserAvatar name={moment.author.username} src={moment.author.avatar} className="size-10" />
            <div className="min-w-0"><p className="truncate text-sm font-bold">{moment.author.username}</p><WenyouTime value={moment.createdAt} className="text-xs text-muted-foreground" /></div>
          </Link>
          <div className="ml-auto flex items-center gap-1">
            {moment.canEdit && !editing ? (
              <Tooltip content="编辑动态">
                <Button variant="ghost" size="icon-sm" onClick={startEditing} aria-label="编辑动态"><Pencil /></Button>
              </Tooltip>
            ) : null}
            {moment.canDelete ? (
              <Tooltip content="删除动态" disabled={remove.isPending}>
                <Button variant="ghost" size="icon-sm" onClick={() => void deleteMoment()} disabled={remove.isPending} aria-label="删除动态"><Trash2 /></Button>
              </Tooltip>
            ) : null}
            {canModerate ? (
              <Tooltip content="站务隐藏动态">
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => setModerationOpen(true)}
                  aria-label="站务隐藏动态"
                  className="text-destructive hover:bg-destructive-soft hover:text-destructive"
                >
                  <ShieldAlert />
                </Button>
              </Tooltip>
            ) : null}
          </div>
        </header>

        {editing ? (
          <div className="mt-4 space-y-3 rounded-xl bg-background/75 p-4">
            <Input value={editTitle} onChange={(event) => setEditTitle(event.target.value)} maxLength={40} aria-label="动态标题" />
            <InternalReferenceEditor
              ref={editContentRef}
              value={editContent}
              onChange={setEditContent}
              maxLength={1000}
              className="min-h-32 max-h-72 bg-background"
              ariaLabel="动态正文"
              disabled={update.isPending}
              onLimitExceeded={() => toast.error("正文最多 1000 个字")}
            />
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <InternalReferenceInsert
                  disabled={update.isPending}
                  getSuggestedLabel={() => editContentRef.current?.getSelectedText() ?? ""}
                  onInsert={insertEditReference}
                  className="text-muted-foreground"
                />
                <span className="font-utility text-xs text-muted-foreground">{Array.from(editTitle).length}/40 · {Array.from(editContent).length}/1000</span>
              </div>
              <div className="flex gap-1">
                <Button variant="ghost" size="sm" onClick={() => setEditing(false)} disabled={update.isPending}>取消</Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-brand-strong"
                  onClick={() => void saveEdit()}
                  pending={update.isPending}
                  pendingLabel="保存中…"
                >
                  <Save />保存
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <h1 id="moment-detail-title" className="mt-4 whitespace-pre-wrap font-display text-2xl font-medium leading-[1.5] tracking-wide sm:text-3xl">{moment.title}</h1>
        )}

        {!editing ? (
          <div
            data-slot="moment-detail-actions"
            className="mt-4 flex flex-wrap items-center gap-1 border-t border-border/75 pt-3 text-muted-foreground"
          >
            <InteractionToggle
              tone="like"
              pressed={moment.viewerLiked}
              pending={like.isPending}
              disabled={!canToggleLike}
              icon="action.like"
              onClick={() => void toggleLike()}
              accessibleName="点赞"
              accessibleDescription={`当前 ${moment.likeCount} 个赞`}
              actionTitle={
                canToggleLike
                  ? moment.viewerLiked ? "取消点赞" : "点赞"
                  : "作者已注销，历史动态仅供阅读"
              }
            >
              {moment.likeCount ? <WenyouCount value={moment.likeCount} label="点赞" /> : "点赞"}
            </InteractionToggle>
            <InteractionToggle
              tone="bookmark"
              pressed={moment.viewerBookmarked}
              pending={bookmark.isPending}
              disabled={!canToggleBookmark}
              icon="action.bookmark"
              onClick={() => void toggleBookmark()}
              accessibleName="收藏"
              accessibleDescription={`当前 ${moment.bookmarkCount} 个收藏`}
              actionTitle={
                canToggleBookmark
                  ? moment.viewerBookmarked ? "取消收藏" : "收藏"
                  : "作者已注销，历史动态仅供阅读"
              }
            >
              {moment.bookmarkCount ? <WenyouCount value={moment.bookmarkCount} label="收藏" /> : "收藏"}
            </InteractionToggle>
            {canAddInteraction && user?.id !== moment.authorId ? <WenyouTipButton target={{ type: "MOMENT", id: moment.id, recipientUserId: moment.authorId }} recipientName={moment.author.username} /> : null}
            {!canAddInteraction ? (
              <span className="text-xs text-muted-foreground" role="status">作者已注销，历史动态仅供阅读</span>
            ) : null}
            <span className="ml-auto font-utility text-xs text-muted-foreground">累计加油 {moment.tipTotal} 升</span>
          </div>
        ) : null}
      </section>

      <MomentImageGallery
        title={moment.title}
        images={moment.images}
        coverMedia={moment.coverMedia}
      />

      <div
        data-slot="moment-detail-reading"
        className="w-full px-5 py-7 sm:px-7"
      >
        {!editing && moment.content ? <p className="whitespace-pre-wrap break-words text-[1.0625rem] leading-8 text-foreground"><InternalReferenceText content={moment.content} /></p> : null}

        <MomentComments momentId={moment.id} canInteract={canAddInteraction} />
      </div>
      </article>
      {canModerate ? (
        <AdminContentModerationDialog
          target={{ type: "moment", id: moment.id, label: "动态" }}
          open={moderationOpen}
          onOpenChange={setModerationOpen}
          onHidden={() => {
            if (onDeleted) onDeleted();
            else router.replace("/moments");
          }}
        />
      ) : null}
      <BookmarkFolderPickerDialog
        open={bookmarkPickerOpen}
        onOpenChange={setBookmarkPickerOpen}
        contentLabel={moment.title}
        kind="moments"
        isPending={bookmark.isPending}
        onConfirm={async (folderId) => {
          try {
            await bookmark.mutateAsync(folderId);
          } catch (error) {
            toast.error(getApiErrorMessage(error, "收藏失败"));
            throw error;
          }
        }}
      />
    </>
  );
}
