/** 通知列表：无限滚动 + 三态 + 全部已读 */

"use client";

import { useEffect, useRef } from "react";
import { Loader2, CheckCheck, ChevronDown } from "lucide-react";
import { toast } from "sonner";
import { useNotifications } from "@/api/hooks/use-notifications";
import { useNotificationActions } from "@/api/hooks/use-notification-actions";
import { NotificationItem } from "@/components/notification/notification-item";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";

export function NotificationList() {
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    isError,
    refetch,
  } = useNotifications();
  const { markAllRead } = useNotificationActions();

  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasNextPage && !isFetchingNextPage) {
          fetchNextPage();
        }
      },
      { threshold: 0.1 },
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const notifications = data?.pages.flatMap((page) => page?.data ?? []) ?? [];

  const handleMarkAllRead = async () => {
    try {
      await markAllRead.mutateAsync();
      toast.success("已全部标记为已读");
    } catch {
      toast.error("操作失败，请稍后重试");
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex flex-col items-center gap-4 py-16">
        <EmptyState title="通知加载失败" description="请稍后重试" />
        <Button variant="outline" size="sm" onClick={() => refetch()}>
          重试
        </Button>
      </div>
    );
  }

  if (notifications.length === 0) {
    return <EmptyState title="暂无通知" description="新的回复、@提及、关注等会出现在这里" />;
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-end">
        <Button
          variant="ghost"
          size="sm"
          onClick={handleMarkAllRead}
          disabled={markAllRead.isPending}
          className="text-xs"
        >
          <CheckCheck className="mr-1.5 h-3.5 w-3.5" />
          全部已读
        </Button>
      </div>

      {notifications.map((notification) => (
        <NotificationItem key={notification.id} notification={notification} />
      ))}

      <div ref={sentinelRef} className="flex items-center justify-center py-2">
        {isFetchingNextPage && (
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        )}
        {hasNextPage && !isFetchingNextPage && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => fetchNextPage()}
            className="text-xs"
          >
            <ChevronDown className="mr-1 h-3.5 w-3.5" />
            加载更多
          </Button>
        )}
        {!hasNextPage && (
          <span className="text-xs text-muted-foreground">没有更多了</span>
        )}
      </div>
    </div>
  );
}
