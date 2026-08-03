/** 楼层卡片组件：Markdown 渲染 + 作者信息 + 时间 + 编辑/删除（作者本人，楼层均可删） */

"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { zhCN } from "date-fns/locale";
import { MessageSquare, Pencil, Trash2, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth";
import { useDeletePost } from "@/api/hooks/use-delete-post";
import { useQueryClient } from "@tanstack/react-query";
import { MarkdownContent } from "@/components/thread/markdown-content";
import { ThreadComposerOutlet } from "@/components/thread/thread-composer";
import { useThreadComposer } from "@/components/thread/thread-composer-context";
import { UserAvatar } from "@/components/shared/user-avatar";
import { Button, buttonVariants } from "@/components/ui/button";
import type { PostData } from "@/api/hooks/use-floors";

interface FloorCardProps {
  floor: PostData;
  isEven: boolean;
  focused?: boolean;
}

export function FloorCard({ floor, isEven, focused = false }: FloorCardProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const cardRef = useRef<HTMLDivElement>(null);
  const deletePost = useDeletePost();
  const { session, open } = useThreadComposer();

  const isAuthor = !!user && user.id === floor.authorId;
  const editAnchorId = `floor-edit:${floor.id}`;
  const isEditing = session?.key === `edit:${floor.id}`;
  const discussionHref = `/threads/${floor.threadId}/posts/${floor.id}/replies`;

  useEffect(() => {
    if (!focused) return;
    const timer = window.setTimeout(() => {
      cardRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 100);
    return () => window.clearTimeout(timer);
  }, [focused]);

  const invalidateFloors = () =>
    queryClient.invalidateQueries({
      queryKey: ["floors", floor.subthreadId],
    });

  const handleStartEdit = () => {
    open({
      key: `edit:${floor.id}`,
      anchorId: editAnchorId,
      type: "edit",
      subthreadId: floor.subthreadId,
      postId: floor.id,
      version: floor.version,
      label: `编辑 #${floor.floorNumber ?? ""}`,
      initialContent: floor.content,
    });
  };

  const handleDelete = async () => {
    if (!confirm("确定要删除该楼层吗？删除后无法恢复。")) return;
    try {
      await deletePost.mutateAsync(floor.id);
      await invalidateFloors();
      toast.success("楼层已删除");
    } catch (error: unknown) {
      const err = error as { code?: number; message?: string };
      toast.error(err.message || "删除失败，请稍后重试");
    }
  };

  return (
    <div
      ref={cardRef}
      id={`post-${floor.id}`}
      className={cn(
        "rounded-xl border border-border p-4 transition-colors",
        isEven ? "bg-muted/30" : "bg-card",
        focused && "border-primary bg-primary/[0.06] ring-2 ring-primary/20",
      )}
    >
      {/* 楼层头部 */}
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <UserAvatar
            name={floor.author.username}
            src={floor.author.avatar}
            className="h-8 w-8"
            textClassName="text-sm"
          />
          <Link
            href={`/users/${floor.authorId}`}
            className="text-sm font-medium text-foreground hover:text-primary"
          >
            {floor.author.username}
          </Link>
          {floor.floorNumber != null && (
            <span className="text-xs text-muted-foreground">
              #{floor.floorNumber}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <span className="text-xs text-muted-foreground">
            {formatDistanceToNow(new Date(floor.createdAt), {
              addSuffix: true,
              locale: zhCN,
            })}
          </span>
          {isAuthor && !isEditing && (
            <>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2"
                onClick={handleStartEdit}
                title="编辑楼层"
              >
                <Pencil className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-destructive hover:text-destructive"
                onClick={handleDelete}
                title="删除楼层"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </>
          )}
        </div>
      </div>

      {/* 楼层正文 / 编辑态 */}
      {isEditing ? (
        <ThreadComposerOutlet anchorId={editAnchorId} />
      ) : (
        <MarkdownContent content={floor.content} />
      )}

      {/* 回复数 / 回复按钮 */}
      {!isEditing && (
        <div className="mt-3 flex items-center justify-between border-t border-border pt-2">
          {floor._count.replies > 0 ? (
            <Link
              href={discussionHref}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            >
              <MessageSquare className="h-3.5 w-3.5" />
              {floor._count.replies} 条回复
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          ) : (
            <span className="text-xs text-muted-foreground">暂无回复</span>
          )}
          {user && floor.floorNumber != null && (
            <Link
              href={discussionHref}
              className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "h-6 px-2 text-xs")}
            >
              <MessageSquare className="mr-1 h-3.5 w-3.5" />
              回复
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
