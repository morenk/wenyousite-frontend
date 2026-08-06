/** 通知列表：无限滚动 + 三态 + 全部已读 */

"use client";

import { useEffect } from "react";
import { Loader2, CheckCheck, ChevronDown } from "lucide-react";
import { toast } from "sonner";
import { useNotifications } from "@/api/hooks/use-notifications";
import { useNotificationActions } from "@/api/hooks/use-notification-actions";
import { useAuth } from "@/lib/auth";
import { NotificationItem } from "@/components/notification/notification-item";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { useInfiniteScroll } from "@/hooks/use-infinite-scroll";

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
  const { markAllRead } = useNotificationActions();

  const sentinelRef = useInfiniteScroll({
    hasNextPage: !!hasNextPage,
    isFetchingNextPage,
    onLoadMore: fetchNextPage,
  });

  const notifications = data?.pages.flatMap((page) => page?.data ?? []) ?? [];
  const hasUnread = notifications.some((notification) => !notification.isRead);
  const loadMoreFailed = Boolean(isFetchNextPageError);

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
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex flex-wrap gap-1">
          {NOTIFICATION_FILTERS.map((filter) => (
            <Button
              key={filter.value ?? "all"}
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
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : isError ? (
        <div className="flex flex-col items-center gap-4 py-16">
          <EmptyState title="通知加载失败" description="请稍后重试" />
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            重试
          </Button>
        </div>
      ) : notifications.length === 0 ? (
        <EmptyState title="暂无通知" description="新的回复、@提及、关注等会出现在这里" />
      ) : (
        <>
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
            {loadMoreFailed && (
              <Button variant="outline" size="sm" onClick={() => refetch()} className="text-xs">
                加载失败，重试
              </Button>
            )}
            {!hasNextPage && (
              <span className="text-xs text-muted-foreground">没有更多了</span>
            )}
          </div>
        </>
      )}
    </div>
  );
}

const NOTIFICATION_FILTERS = [
  { label: "全部", value: undefined },
  { label: "回复与提及", value: "reply,mention" },
  { label: "主题更新", value: "new_post,thread_created" },
  { label: "关注与点赞", value: "follow,like" },
  { label: "系统", value: "system" },
] as const;
