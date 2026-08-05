/** 搜索结果展示：主题帖 / 楼层两栏 */

"use client";

import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { zhCN } from "date-fns/locale";
import { MessageSquare, FileText, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { EmptyState } from "@/components/shared/empty-state";
import { UserAvatar } from "@/components/shared/user-avatar";
import type { SearchResult } from "@/api/hooks/use-search";

const categoryLabel: Record<string, string> = {
  DEDUCTION: "演绎",
  NATION: "国策",
  RPG: "RPG",
};

const categoryColor: Record<string, string> = {
  DEDUCTION: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
  NATION: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  RPG: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400",
};

interface SearchResultsProps {
  data: SearchResult;
}

export function SearchResults({ data }: SearchResultsProps) {
  const { users, threads, posts } = data;

  if (users.length === 0 && threads.length === 0 && posts.length === 0) {
    return <EmptyState title="没有找到相关内容" description="换个关键词试试" />;
  }

  return (
    <div className="space-y-6">
      {users.length > 0 && (
        <section>
          <h2 className="mb-3 flex items-center gap-2 text-base font-semibold text-foreground">
            <Users className="h-4 w-4 text-muted-foreground" />
            用户（{users.length}）
          </h2>
          <div className="space-y-3">
            {users.map((user) => (
              <Link
                key={user.id}
                href={`/users/${user.id}`}
                className="flex items-center gap-3 rounded-xl border border-border bg-card p-4 transition-shadow hover:shadow-md"
              >
                <UserAvatar
                  name={user.username}
                  src={user.avatar}
                  className="h-10 w-10"
                />
                <div className="min-w-0">
                  <h3 className="text-sm font-semibold text-foreground">
                    {user.username}
                  </h3>
                  {user.bio && (
                    <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">
                      {user.bio}
                    </p>
                  )}
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {threads.length > 0 && (
        <section>
          <h2 className="mb-3 flex items-center gap-2 text-base font-semibold text-foreground">
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
            主题帖（{threads.length}）
          </h2>
          <div className="space-y-3">
            {threads.map((thread) => (
              <Link
                key={thread.id}
                href={`/threads/${thread.id}`}
                className="block rounded-xl border border-border bg-card p-4 transition-shadow hover:shadow-md"
              >
                <div className="mb-1.5 flex items-center gap-2">
                  <span
                    className={cn(
                      "rounded-full px-2.5 py-0.5 text-xs font-medium",
                      categoryColor[thread.category] ?? "bg-muted text-muted-foreground",
                    )}
                  >
                    {categoryLabel[thread.category] ?? thread.category}
                  </span>
                </div>
                <h3 className="text-sm font-semibold text-foreground line-clamp-1">
                  {thread.title}
                </h3>
                <p className="mt-1 text-xs text-muted-foreground">
                  {thread.owner.username} ·{" "}
                  {formatDistanceToNow(new Date(thread.createdAt), {
                    addSuffix: true,
                    locale: zhCN,
                  })}
                </p>
              </Link>
            ))}
          </div>
        </section>
      )}

      {posts.length > 0 && (
        <section>
          <h2 className="mb-3 flex items-center gap-2 text-base font-semibold text-foreground">
            <FileText className="h-4 w-4 text-muted-foreground" />
            楼层内容（{posts.length}）
          </h2>
          <div className="space-y-3">
            {posts.map((post) => (
              <Link
                key={post.id}
                href={`/threads/${post.thread.id}`}
                className="block rounded-xl border border-border bg-card p-4 transition-shadow hover:shadow-md"
              >
                <p className="mb-1.5 text-sm text-foreground/90 line-clamp-2">
                  {post.content}
                </p>
                <p className="text-xs text-muted-foreground">
                  {post.author.username}
                  {post.floorNumber != null ? ` · #${post.floorNumber}` : ""} ·{" "}
                  {post.thread.title}
                </p>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
