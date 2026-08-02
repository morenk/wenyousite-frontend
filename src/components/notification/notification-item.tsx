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
import type { NotificationItem as NotificationItemData } from "@/api/hooks/use-notifications";

interface NotificationItemProps {
  notification: NotificationItemData;
}

export function NotificationItem({ notification }: NotificationItemProps) {
  const { markRead, remove } = useNotificationActions();

  const Icon = typeIconMap[notification.type] ?? MessageSquare;
  const displayContent = sanitizeNotificationContent(notification);
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

  const content = href ? (
    <Link
      href={href}
      onClick={handleOpen}
      className="flex items-start gap-3"
    >
      {inner}
    </Link>
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

/** 兼容旧通知中残留的图片 Markdown 及 Milkdown 比例 alt。 */
function sanitizeNotificationContent(notification: NotificationItemData): string {
  let content = (notification.content ?? "")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
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
