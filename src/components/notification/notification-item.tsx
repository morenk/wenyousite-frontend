/** 单条通知：类型图标 + 文案 + 时间 + 未读高亮 + 跳转 + 删除 */

"use client";

import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { zhCN } from "date-fns/locale";
import {
  MessageSquare,
  AtSign,
  PenLine,
  FilePlus,
  UserPlus,
  Heart,
  Megaphone,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useNotificationActions } from "@/api/hooks/use-notification-actions";
import { UserAvatar } from "@/components/shared/user-avatar";
import type { NotificationItem as NotificationItemData } from "@/api/hooks/use-notifications";

interface NotificationItemProps {
  notification: NotificationItemData;
}

export function NotificationItem({ notification }: NotificationItemProps) {
  const { markRead, remove } = useNotificationActions();

  const Icon = typeIconMap[notification.type] ?? MessageSquare;
  const displayContent = sanitizeNotificationContent(notification);
  const deletedHint = getDeletedHint(notification);
  const href = notification.postId && notification.threadId
    ? `/threads/${notification.threadId}?post=${notification.postId}`
    : notification.threadId
      ? `/threads/${notification.threadId}`
    : notification.fromUserId
      ? `/users/${notification.fromUserId}`
      : null;

  const handleOpen = () => {
    if (!notification.isRead) {
      markRead.mutate(notification.id);
    }
    if (deletedHint) {
      toast.info(deletedHint);
    }
  };

  const handleDelete = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      await remove.mutateAsync(notification.id);
      toast.success("已删除");
    } catch {
      toast.error("操作失败，请稍后重试");
    }
  };

  const inner = (
    <>
      {notification.fromUser ? (
        <UserAvatar
          name={notification.fromUser.username}
          src={notification.fromUser.avatar}
          className="h-9 w-9"
          textClassName="text-sm"
        />
      ) : (
        <div
          className={cn(
            "flex h-9 w-9 shrink-0 items-center justify-center rounded-full",
            notification.isRead
              ? "bg-muted text-muted-foreground"
              : "bg-primary/10 text-primary",
          )}
        >
          <Icon className="h-4.5 w-4.5" />
        </div>
      )}
      <div className="min-w-0 flex-1">
        <p
          className={cn(
            "text-sm leading-relaxed",
            notification.isRead
              ? "text-muted-foreground"
              : "text-foreground",
          )}
        >
          {displayContent || "（图片内容）"}
        </p>
        {deletedHint && (
          <p className="mt-1 text-xs font-medium text-destructive">{deletedHint}</p>
        )}
        <p className="mt-0.5 text-xs text-muted-foreground">
          {formatDistanceToNow(new Date(notification.createdAt), {
            addSuffix: true,
            locale: zhCN,
          })}
        </p>
      </div>
      {!notification.isRead && (
        <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary" />
      )}
    </>
  );

  const content = href && !deletedHint ? (
    <Link
      href={href}
      onClick={handleOpen}
      className="flex items-start gap-3"
    >
      {inner}
    </Link>
  ) : deletedHint ? (
    <div onClick={handleOpen} className="flex cursor-default items-start gap-3">
      {inner}
    </div>
  ) : (
    <div className="flex items-start gap-3">{inner}</div>
  );

  return (
    <div
      className={cn(
        "relative rounded-xl border p-3.5",
        notification.isRead
          ? "border-border bg-card"
          : "border-primary/20 bg-primary/[0.03]",
      )}
    >
      {content}
      <button
        type="button"
        onClick={handleDelete}
        title="删除通知"
        className="absolute right-1.5 top-1.5 rounded p-1 text-muted-foreground/60 hover:bg-muted hover:text-foreground"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

/** 跳转对象已被删除时的提示文案；目标存在则返回 null（不拦截跳转） */
function getDeletedHint(notification: NotificationItemData): string | null {
  if (notification.threadId && notification.thread?.deletedAt) return "该内容已删除";
  if (notification.postId && notification.post?.deletedAt) return "该内容已删除";
  if (notification.fromUserId && notification.fromUser?.deletedAt) return "该用户已注销";
  return null;
}

/** 兼容旧通知中残留的图片 Markdown、Milkdown 比例 alt、转义反斜杠及硬换行。 */
function sanitizeNotificationContent(notification: NotificationItemData): string {
  let content = (notification.content ?? "")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
    // Milkdown 序列化把 < > 等标点转义为 \< \>，通知预览是纯文本，只去掉反斜杠还原为标点本身。
    .replace(/\\([!-/:-@[-`{-~])/g, "$1")
    // Milkdown 硬换行（行尾反斜杠 + 换行）还原为普通换行，避免预览残留字面 \。
    .replace(/\\\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  const preview = typeof notification.payload?.preview === "string"
    ? notification.payload.preview.trim()
    : "";
  if (preview === "1.00") {
    content = content.replace(/1\.00\s*$/, "").trimEnd();
  }
  return content;
}

const typeIconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  reply: MessageSquare,
  mention: AtSign,
  new_post: PenLine,
  thread_created: FilePlus,
  follow: UserPlus,
  like: Heart,
  system: Megaphone,
};
