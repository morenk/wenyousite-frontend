/** 通知列表：无限滚动 + 三态 + 全部已读 */

"use client";

import { useEffect } from "react";
import { Loader2, CheckCheck, ChevronDown } from "lucide-react";
import { toast } from "sonner";
import { useNotifications } from "@/api/hooks/use-notifications";
import { useNotificationActions } from "@/api/hooks/use-notification-actions";
import { useAuth } from "@/lib/auth";
import { useUnreadCounts } from "@/components/layout/unread-counts-context";
import { NotificationItem } from "@/components/notification/notification-item";
import { EmptyState } from "@/components/shared/empty-state";
import { LoadError } from "@/components/shared/load-error";
import { LoadingState } from "@/components/shared/loading-state";
import { Button } from "@/components/ui/button";
import { useInfiniteScroll } from "@/hooks/use-infinite-scroll";
import { NOTIFICATION_FILTERS } from "@/lib/notification-filters";

interface NotificationListProps {
  type?: string;
  onTypeChange: (type: string | undefined) => void;
}

export function NotificationList({ type, onTypeChange }: NotificationListProps) {
  const { user } = useAuth();
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isFetchNextPageError,
    isLoading,
    isError,
    refetch,
  } = useNotifications({ type, userId: user?.id });
  const { notificationCount } = useUnreadCounts();
  const { markAllRead } = useNotificationActions();
  const loadMoreFailed = Boolean(isFetchNextPageError);

  const sentinelRef = useInfiniteScroll({
    hasNextPage: !!hasNextPage && !loadMoreFailed,
    isFetchingNextPage,
    onLoadMore: fetchNextPage,
  });

  const notifications = data?.pages.flatMap((page) => page?.data ?? []) ?? [];
  const hasUnread = notificationCount > 0;

  useEffect(() => {
    const refresh = () => refetch();
    window.addEventListener("focus", refresh);
    return () => window.removeEventListener("focus", refresh);
  }, [refetch]);

  const handleMarkAllRead = async () => {
    try {
      await markAllRead.mutateAsync();
      toast.success("已全部标记为已读");
    } catch {
      toast.error("操作失败，请稍后重试");
    }
  };

  return (
    <div className="w-full space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex flex-wrap gap-1">
          {NOTIFICATION_FILTERS.map((filter) => (
            <Button
              key={filter.id}
              variant={type === filter.value ? "secondary" : "ghost"}
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={() => onTypeChange(filter.value)}
            >
              {filter.label}
            </Button>
          ))}
        </div>
        {hasUnread && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleMarkAllRead}
            disabled={markAllRead.isPending}
            className="shrink-0 text-xs"
          >
            <CheckCheck className="mr-1.5 h-3.5 w-3.5" />
            全部已读
          </Button>
        )}
      </div>

      {isLoading ? (
        <LoadingState label="" className="min-h-0 py-16" />
      ) : isError ? (
        <LoadError title="通知加载失败" onRetry={() => void refetch()} className="py-16" />
      ) : notifications.length === 0 ? (
        <EmptyState title="暂无通知" />
      ) : (
        <>
          {notifications.map((notification) => (
            <NotificationItem key={notification.id} notification={notification} />
          ))}

          <div ref={sentinelRef} className="flex items-center justify-center py-2">
            {isFetchingNextPage && (
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            )}
            {hasNextPage && !isFetchingNextPage && !loadMoreFailed && (
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
            {loadMoreFailed && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => fetchNextPage()}
                className="text-xs"
              >
                加载失败，重试
              </Button>
            )}
            {!hasNextPage && !loadMoreFailed && (
              <span className="text-xs text-muted-foreground">没有更多了</span>
            )}
          </div>
        </>
      )}
    </div>
  );
}
