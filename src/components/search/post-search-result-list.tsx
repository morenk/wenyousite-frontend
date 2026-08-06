/** 全站与帖内楼层搜索共用的结果列表和精确定位入口。 */

"use client";

import Link from "next/link";
import { Loader2 } from "lucide-react";
import type { SearchPost } from "@/api/hooks/use-search";
import { getPostHref } from "@/lib/post-navigation";
import { formatMarkdownPreview } from "@/lib/markdown-preview";
import { Button } from "@/components/ui/button";

interface PostSearchResultListProps {
  posts: SearchPost[];
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  onLoadMore: () => void;
  context?: "global" | "thread";
  onSelect?: () => void;
}

export function PostSearchResultList({
  posts,
  hasNextPage,
  isFetchingNextPage,
  onLoadMore,
  context = "global",
  onSelect,
}: PostSearchResultListProps) {
  return (
    <div className="space-y-3">
      {posts.map((post) => (
        <Link
          key={post.id}
          href={getPostHref({
            threadId: post.thread.id,
            postId: post.id,
            parentPostId: post.parentPostId,
          })}
          onClick={onSelect}
          className="block rounded-xl border border-border bg-card p-4 transition-shadow hover:shadow-md"
        >
          <p className="mb-1.5 line-clamp-2 text-sm text-foreground/90">
            {formatMarkdownPreview(post.content)}
          </p>
          <p className="text-xs text-muted-foreground">
            {post.author.username} · {post.floorNumber != null
              ? `#${post.floorNumber}`
              : "楼中楼"} · {post.subthread.title}
            {context === "global" ? ` · ${post.thread.title}` : ""}
          </p>
        </Link>
      ))}

      {hasNextPage && (
        <div className="flex justify-center pt-2">
          <Button
            type="button"
            variant="outline"
            disabled={isFetchingNextPage}
            onClick={onLoadMore}
          >
            {isFetchingNextPage && (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            )}
            加载更多楼层
          </Button>
        </div>
      )}
    </div>
  );
}
