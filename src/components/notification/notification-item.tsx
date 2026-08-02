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
  const href = notification.threadId
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
          {notification.content ?? "（无内容）"}
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

const typeIconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  reply: MessageSquare,
  mention: AtSign,
  new_post: PenLine,
  thread_created: FilePlus,
  follow: UserPlus,
  like: Heart,
  system: Megaphone,
};
