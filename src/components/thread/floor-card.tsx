/** 楼层卡片组件：Markdown 渲染 + 作者信息 + 时间 + 编辑/删除（作者本人） */

"use client";

import { useState } from "react";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { zhCN } from "date-fns/locale";
import { MessageSquare, Pencil, Trash2, Loader2, Check, X } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth";
import { useUpdatePost } from "@/api/hooks/use-update-post";
import { useDeletePost } from "@/api/hooks/use-delete-post";
import { useQueryClient } from "@tanstack/react-query";
import { MarkdownContent } from "@/components/thread/markdown-content";
import { Button } from "@/components/ui/button";
import type { PostData } from "@/api/hooks/use-floors";

interface FloorCardProps {
  floor: PostData;
  isEven: boolean;
}

export function FloorCard({ floor, isEven }: FloorCardProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(floor.content);
  const updatePost = useUpdatePost();
  const deletePost = useDeletePost();

  const isAuthor = !!user && user.id === floor.authorId;
  const isFirstFloor = floor.floorNumber === 1;

  const invalidateFloors = () =>
    queryClient.invalidateQueries({
      queryKey: ["floors", floor.subthreadId],
    });

  const handleStartEdit = () => {
    setEditContent(floor.content);
    setIsEditing(true);
  };

  const handleSave = async () => {
    const content = editContent.trim();
    if (!content) {
      toast.error("正文不能为空");
      return;
    }
    try {
      await updatePost.mutateAsync({
        postId: floor.id,
        content,
        version: floor.version,
      });
      setIsEditing(false);
      await invalidateFloors();
      toast.success("已保存");
    } catch (error: unknown) {
      const err = error as { code?: number; message?: string };
      if (err.code === 40900) {
        toast.error("内容已被修改，请刷新后重试");
      } else {
        toast.error(err.message || "保存失败，请稍后重试");
      }
    }
  };

  const handleDelete = async () => {
    if (!confirm("确定要删除该楼层吗？删除后无法恢复。")) return;
    try {
      await deletePost.mutateAsync(floor.id);
      await invalidateFloors();
      toast.success("楼层已删除");
    } catch (error: unknown) {
      const err = error as { code?: number; message?: string };
      if (err.code === 40000 && /第一楼/.test(err.message ?? "")) {
        toast.error("不能删除子贴第一楼");
      } else {
        toast.error(err.message || "删除失败，请稍后重试");
      }
    }
  };

  return (
    <div
      className={cn(
        "rounded-xl border border-border p-4",
        isEven ? "bg-muted/30" : "bg-card",
      )}
    >
      {/* 楼层头部 */}
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
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
                disabled={isFirstFloor}
                title={isFirstFloor ? "不能删除子贴第一楼" : "删除楼层"}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </>
          )}
        </div>
      </div>

      {/* 楼层正文 / 编辑态 */}
      {isEditing ? (
        <div className="space-y-2">
          <textarea
            value={editContent}
            onChange={(e) => setEditContent(e.target.value)}
            rows={4}
            className="w-full resize-y rounded-lg border border-border bg-background p-3 text-sm outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          />
          <div className="flex items-center justify-end gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsEditing(false)}
              disabled={updatePost.isPending}
            >
              <X className="mr-1 h-3.5 w-3.5" />
              取消
            </Button>
            <Button
              size="sm"
              onClick={handleSave}
              disabled={!editContent.trim() || updatePost.isPending}
            >
              {updatePost.isPending ? (
                <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
              ) : (
                <Check className="mr-1 h-3.5 w-3.5" />
              )}
              保存
            </Button>
          </div>
        </div>
      ) : (
        <MarkdownContent content={floor.content} />
      )}

      {/* 回复数 */}
      {!isEditing && floor._count.replies > 0 && (
        <div className="mt-3 flex items-center gap-1 text-xs text-muted-foreground">
          <MessageSquare className="h-3.5 w-3.5" />
          {floor._count.replies} 条回复
        </div>
      )}
    </div>
  );
}
