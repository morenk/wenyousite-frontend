"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { format } from "date-fns";
import { zhCN } from "date-fns/locale";
import { Bookmark, ChevronLeft, ChevronRight, Heart, Loader2, Pencil, Save, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useDeleteMoment, useMoment, useMomentBookmark, useMomentLike, useUpdateMoment } from "@/api/hooks/use-moments";
import { getApiErrorMessage } from "@/api/errors";
import { MomentComments } from "@/components/moment/moment-comments";
import { WenyouTipButton } from "@/components/economy/wenyou-tip-button";
import { ImageLightbox } from "@/components/shared/image-lightbox";
import { LoadError } from "@/components/shared/load-error";
import { UserAvatar } from "@/components/shared/user-avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useConfirm } from "@/components/ui/confirm-provider";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";

function getCarouselAspectRatio(image: { width: number | null; height: number | null } | null | undefined): number {
  if (!image?.width || !image.height) return 1;
  return Math.max(3 / 4, Math.min(16 / 10, image.width / image.height));
}

export function MomentDetailView({ momentId, onDeleted }: { momentId: string; onDeleted?: () => void }) {
  const { user } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const detail = useMoment(momentId, user?.id);
  const [lightbox, setLightbox] = useState<string | null>(null);
  const [activeImageId, setActiveImageId] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editContent, setEditContent] = useState("");
  const confirm = useConfirm();
  const remove = useDeleteMoment();
  const update = useUpdateMoment();
  const moment = detail.data;
  const like = useMomentLike(momentId, moment?.viewerLiked ?? false);
  const bookmark = useMomentBookmark(momentId, moment?.viewerBookmarked ?? false);

  if (detail.isLoading) {
    return <div className="flex min-h-[32rem] items-center justify-center" role="status"><Loader2 className="size-5 animate-spin text-muted-foreground" /></div>;
  }
  if (detail.isError || !moment) {
    return <LoadError title="动态不存在" description="它可能已被删除，或当前不可见。" onRetry={() => void detail.refetch()} className="py-24" />;
  }

  const requireLogin = () => {
    if (user) return true;
    router.push(`/login?next=${encodeURIComponent(pathname)}`);
    return false;
  };
  const toggleLike = async () => {
    if (like.isPending || !requireLogin()) return;
    try { await like.mutateAsync(); } catch (error) { toast.error(getApiErrorMessage(error, "点赞失败")); }
  };
  const toggleBookmark = async () => {
    if (!requireLogin()) return;
    try { await bookmark.mutateAsync(); } catch (error) { toast.error(getApiErrorMessage(error, "收藏失败")); }
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
    try {
      await update.mutateAsync({
        id: moment.id,
        body: { title, content: editContent, version: moment.version },
      });
      setEditing(false);
      toast.success("动态已更新");
    } catch (error) {
      toast.error(getApiErrorMessage(error, "编辑失败，请刷新后重试"));
    }
  };
  const activeImageIndex = Math.max(0, moment.images.findIndex((image) => image.id === activeImageId));
  const activeImage = moment.images[activeImageIndex];
  const carouselAspectRatio = getCarouselAspectRatio(moment.coverMedia ?? moment.images[0]);
  const showImage = (index: number) => {
    if (moment.images.length < 2) return;
    const wrappedIndex = (index + moment.images.length) % moment.images.length;
    setActiveImageId(moment.images[wrappedIndex].id);
  };

  return (
    <article className="w-full bg-background">
      <section
        data-slot="moment-detail-title-card"
        className="mb-3 w-full rounded-2xl bg-muted/35 px-5 py-4 sm:px-7"
        aria-label="动态标题与作者"
      >
        <header data-slot="moment-detail-header" className="flex items-center gap-3">
          <Link href={`/users/${moment.author.id}`} className="flex min-w-0 items-center gap-3 rounded-xl">
            <UserAvatar name={moment.author.username} src={moment.author.avatar} className="size-10" />
            <div className="min-w-0"><p className="truncate text-sm font-bold">{moment.author.username}</p><time className="font-utility text-xs text-muted-foreground" dateTime={moment.createdAt}>{format(new Date(moment.createdAt), "yyyy年M月d日 HH:mm", { locale: zhCN })}</time></div>
          </Link>
          <div className="ml-auto flex items-center gap-1">
            {moment.canEdit && !editing ? <Button variant="ghost" size="icon-sm" onClick={startEditing} aria-label="编辑动态" title="编辑动态"><Pencil /></Button> : null}
            {moment.canDelete ? <Button variant="ghost" size="icon-sm" onClick={() => void deleteMoment()} disabled={remove.isPending} aria-label="删除动态" title="删除动态"><Trash2 /></Button> : null}
          </div>
        </header>

        {editing ? (
          <div className="mt-4 space-y-3 rounded-xl bg-background/75 p-4">
            <Input value={editTitle} onChange={(event) => setEditTitle(event.target.value)} maxLength={40} aria-label="动态标题" />
            <Textarea value={editContent} onChange={(event) => setEditContent(event.target.value)} maxLength={1000} className="min-h-32 resize-none bg-background" aria-label="动态正文" />
            <div className="flex items-center justify-between gap-3">
              <span className="font-utility text-xs text-muted-foreground">{Array.from(editTitle).length}/40 · {Array.from(editContent).length}/1000</span>
              <div className="flex gap-1">
                <Button variant="ghost" size="sm" onClick={() => setEditing(false)} disabled={update.isPending}>取消</Button>
                <Button variant="ghost" size="sm" className="text-brand-strong" onClick={() => void saveEdit()} disabled={update.isPending}>{update.isPending ? <Loader2 className="animate-spin" /> : <Save />}保存</Button>
              </div>
            </div>
          </div>
        ) : (
          <h1 id="moment-detail-title" className="mt-4 whitespace-pre-wrap font-display text-2xl font-bold leading-[1.5] tracking-wide sm:text-3xl">{moment.title}</h1>
        )}
      </section>

      {activeImage ? (
        <div data-slot="moment-detail-carousel" className="w-full bg-muted/40 p-2">
          <div className="relative">
            <button
              key={activeImage.id}
              type="button"
              data-slot="moment-detail-image"
              onClick={() => setLightbox(activeImage.url)}
              className="relative w-full max-h-[min(72vh,42rem)] overflow-hidden rounded-xl bg-muted"
              style={{ aspectRatio: carouselAspectRatio }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- COS 处理中图已按契约选择 */}
              <img
                src={activeImage.mediumUrl ?? activeImage.url}
                alt={`${moment.title}，第 ${activeImageIndex + 1} 张图片`}
                width={activeImage.width ?? undefined}
                height={activeImage.height ?? undefined}
                className="h-full w-full object-contain"
              />
            </button>
            {moment.images.length > 1 ? (
              <>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => showImage(activeImageIndex - 1)}
                  className="absolute left-3 top-1/2 z-10 -mt-4 bg-foreground/60 text-background shadow-popover hover:bg-foreground/75 hover:text-background"
                  aria-label="上一张图片"
                >
                  <ChevronLeft />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => showImage(activeImageIndex + 1)}
                  className="absolute right-3 top-1/2 z-10 -mt-4 bg-foreground/60 text-background shadow-popover hover:bg-foreground/75 hover:text-background"
                  aria-label="下一张图片"
                >
                  <ChevronRight />
                </Button>
                <span className="absolute bottom-3 right-3 z-10 rounded-full bg-foreground/60 px-2.5 py-1 font-utility text-xs font-bold tabular-nums text-background" aria-live="polite">
                  {activeImageIndex + 1} / {moment.images.length}
                </span>
              </>
            ) : null}
          </div>
        </div>
      ) : null}

      <div
        data-slot="moment-detail-reading"
        className="w-full px-5 py-7 sm:px-7"
      >
        {!editing && moment.content ? <p className="whitespace-pre-wrap break-words text-[1.0625rem] leading-8 text-foreground">{moment.content}</p> : null}

        <div className="mt-7 flex flex-wrap items-center gap-1 text-muted-foreground">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => void toggleLike()}
            aria-disabled={like.isPending}
            className={cn("group/like aria-disabled:cursor-wait", moment.viewerLiked && "text-brand-strong")}
            aria-pressed={moment.viewerLiked}
            aria-label={moment.viewerLiked ? `取消点赞${moment.likeCount > 0 ? `，${moment.likeCount}` : ""}` : `点赞${moment.likeCount > 0 ? `，${moment.likeCount}` : ""}`}
          >
            <Heart className={cn(
              "transition-[color,fill,transform] duration-[var(--motion-fast)] ease-[var(--ease-standard)] motion-safe:group-active/like:scale-90",
              moment.viewerLiked && "fill-current",
            )} />
            {moment.likeCount || "点赞"}
          </Button>
          <Button variant="ghost" size="sm" onClick={() => void toggleBookmark()} disabled={bookmark.isPending} className={cn(moment.viewerBookmarked && "text-brand-strong")} aria-pressed={moment.viewerBookmarked}><Bookmark className={cn(moment.viewerBookmarked && "fill-current")} />{moment.bookmarkCount || "收藏"}</Button>
          {user?.id !== moment.authorId ? <WenyouTipButton target={{ type: "MOMENT", id: moment.id, recipientUserId: moment.authorId }} recipientName={moment.author.username} /> : null}
          <span className="ml-auto font-utility text-xs text-muted-foreground">累计加油 {moment.tipTotal} 升</span>
        </div>

        <MomentComments momentId={moment.id} />
      </div>

      {lightbox ? <ImageLightbox src={lightbox} alt={moment.title} onClose={() => setLightbox(null)} /> : null}
    </article>
  );
}
