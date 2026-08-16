/** 主题帖卡片组件：展示标题、分类、状态、作者、预览、成员/楼层数 */

"use client";

import Link from "next/link";
import { useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { zhCN } from "date-fns/locale";
import { Fuel, LockKeyhole, MessageSquare, Users } from "lucide-react";
import { formatMarkdownPreview } from "@/lib/markdown-preview";
import { THREAD_STATUS_META } from "@/lib/thread-presentation";
import { UserAvatar } from "@/components/shared/user-avatar";
import type { ThreadCardData } from "@/api/hooks/use-threads";
import { floorsQueryOptions } from "@/api/hooks/use-floors";
import { TopicTagLink } from "./topic-tag-link";
import { LevelBadge } from "@/components/shared/level-badge";
import { formatWenyou } from "@/lib/wenyou";
import { Badge } from "@/components/ui/badge";
import { stackListRowVariants } from "@/components/ui/stack-list";
import { ThreadCategoryBadge } from "./thread-category";
import { ThreadCover } from "./thread-cover";

export interface ThreadCardViewData {
  id: ThreadCardData["id"];
  title: ThreadCardData["title"];
  category: ThreadCardData["category"];
  status: ThreadCardData["status"];
  visibility: ThreadCardData["visibility"];
  pinned: ThreadCardData["pinned"];
  tipTotal: ThreadCardData["tipTotal"];
  updatedAt: ThreadCardData["updatedAt"];
  owner: ThreadCardData["owner"];
  defaultSubthread?: ThreadCardData["defaultSubthread"];
  topicTags?: ThreadCardData["topicTags"];
  preview?: ThreadCardData["preview"];
  coverImages?: ThreadCardData["coverImages"];
  _count: {
    posts: number;
    players?: number;
  };
}

interface ThreadCardProps {
  thread: ThreadCardViewData;
}

export function ThreadCard({ thread }: ThreadCardProps) {
  const queryClient = useQueryClient();
  const coverImage = thread.coverImages?.[0] ?? null;
  const formattedPreview = formatMarkdownPreview(thread.preview ?? "");
  const preview = coverImage
    ? formattedPreview.replace(/\[图片\]/gu, " ").replace(/\s{2,}/gu, " ").trim()
    : formattedPreview;
  const topicTags = thread.topicTags ?? [];
  const prefetchThread = () => {
    // 详情接口会记录浏览量，不能在悬停/聚焦时调用；楼层列表是无副作用查询。
    if (thread.defaultSubthread?.id) {
      void queryClient.prefetchInfiniteQuery(
        floorsQueryOptions(thread.defaultSubthread.id),
      );
    }
  };

  return (
    <article
      role="listitem"
      data-category={thread.category}
      className={stackListRowVariants()}
    >
      <div className="flex gap-3.5">
        <UserAvatar
          name={thread.owner.username}
          src={thread.owner.avatar}
          className="mt-0.5 h-11 w-11 ring-2 ring-white outline outline-1 outline-border"
          textClassName="text-sm"
        />

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 items-center gap-1.5 font-utility text-xs text-muted-foreground">
              <span className="truncate font-semibold text-foreground">
                {thread.owner.username}
              </span>
              <LevelBadge level={thread.owner.level} />
              <span aria-hidden="true">·</span>
              <time dateTime={thread.updatedAt} className="shrink-0">
                {formatDistanceToNow(new Date(thread.updatedAt), {
                  addSuffix: true,
                  locale: zhCN,
                })}
              </time>
            </div>

            <div className="relative z-10 flex shrink-0 flex-wrap items-center justify-end gap-1.5">
              <ThreadCategoryBadge
                category={thread.category}
                size="compact"
              />
              <Badge
                tone={THREAD_STATUS_META[thread.status].badgeTone}
                size="compact"
              >
                {THREAD_STATUS_META[thread.status].label}
              </Badge>
              {thread.visibility === "PRIVATE" && (
                <Badge tone="warning" size="compact" className="gap-1">
                  <LockKeyhole className="h-3 w-3" />
                  私密帖
                </Badge>
              )}
              {thread.pinned && (
                <Badge tone="brand" size="compact">
                  置顶
                </Badge>
              )}
            </div>
          </div>

          <h3 className="mt-2 font-display text-[1.0625rem] leading-6 font-bold tracking-[0.01em] text-foreground line-clamp-2">
            <Link
              href={`/threads/${thread.id}`}
              aria-label={`查看主题帖：${thread.title}`}
              onMouseEnter={prefetchThread}
              onFocus={prefetchThread}
              onPointerDown={prefetchThread}
              className="after:absolute after:inset-0 focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-inset focus-visible:after:ring-ring/40"
            >
              {thread.title}
            </Link>
          </h3>

          <ThreadCover image={coverImage} />

          {preview && (
            <p className="mt-1.5 text-sm leading-6 text-muted-foreground line-clamp-2">
              {preview}
            </p>
          )}

          {topicTags.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {topicTags.map(({ tag }) => (
                <TopicTagLink key={tag.id} tag={tag} className="relative z-10" />
              ))}
            </div>
          )}

          <div className="mt-3 flex flex-wrap items-center gap-3 font-utility text-xs font-semibold text-muted-foreground">
            {typeof thread._count.players === "number" && (
              <span className="flex items-center gap-1">
                <Users className="h-3.5 w-3.5" />
                {thread._count.players}
              </span>
            )}
            <span className="flex items-center gap-1">
              <MessageSquare className="h-3.5 w-3.5" />
              {thread._count.posts}
            </span>
            <span className="flex items-center gap-1" title="累计获得温油">
              <Fuel className="h-3.5 w-3.5" />
              {formatWenyou(thread.tipTotal)} 升
            </span>
          </div>
        </div>
      </div>
    </article>
  );
}
