/** 搜索结果展示：主题帖 / 楼层内容 / 用户 Tab */

"use client";

import { useState, type KeyboardEvent } from "react";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { zhCN } from "date-fns/locale";
import { MessageSquare, FileText, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { getPostHref } from "@/lib/post-navigation";
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

type SearchTab = "threads" | "posts" | "users";

const tabOrder: SearchTab[] = ["threads", "posts", "users"];

interface SearchResultsProps {
  data: SearchResult;
}

function getDefaultTab(data: SearchResult): SearchTab {
  if (data.threads.length > 0) return "threads";
  if (data.posts.length > 0) return "posts";
  return "users";
}

export function SearchResults({ data }: SearchResultsProps) {
  const { users, threads, posts } = data;
  const [activeTab, setActiveTab] = useState<SearchTab>(() => getDefaultTab(data));

  if (users.length === 0 && threads.length === 0 && posts.length === 0) {
    return <EmptyState title="没有找到相关内容" description="换个关键词试试" />;
  }

  const tabs = [
    { value: "threads" as const, label: "主题帖", count: threads.length, icon: MessageSquare },
    { value: "posts" as const, label: "楼层内容", count: posts.length, icon: FileText },
    { value: "users" as const, label: "用户", count: users.length, icon: Users },
  ];

  const handleTabKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    let nextIndex: number | undefined;
    if (event.key === "ArrowRight") nextIndex = (index + 1) % tabOrder.length;
    if (event.key === "ArrowLeft") nextIndex = (index - 1 + tabOrder.length) % tabOrder.length;
    if (event.key === "Home") nextIndex = 0;
    if (event.key === "End") nextIndex = tabOrder.length - 1;
    if (nextIndex === undefined) return;

    event.preventDefault();
    const nextTab = tabOrder[nextIndex];
    setActiveTab(nextTab);
    document.getElementById(`search-tab-${nextTab}`)?.focus();
  };

  return (
    <div>
      <div
        role="tablist"
        aria-label="搜索结果分类"
        className="grid grid-cols-3 gap-1 rounded-xl bg-muted p-1"
      >
        {tabs.map((tab, index) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.value;
          return (
            <button
              key={tab.value}
              id={`search-tab-${tab.value}`}
              type="button"
              role="tab"
              aria-label={`${tab.label} ${tab.count}`}
              aria-selected={isActive}
              aria-controls={`search-panel-${tab.value}`}
              tabIndex={isActive ? 0 : -1}
              onClick={() => setActiveTab(tab.value)}
              onKeyDown={(event) => handleTabKeyDown(event, index)}
              className={cn(
                "flex min-w-0 items-center justify-center gap-1.5 rounded-lg px-2 py-2 text-xs font-medium transition-colors sm:text-sm",
                isActive
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span className="truncate">{tab.label}</span>
              <span className="rounded-full bg-muted-foreground/10 px-1.5 text-[11px] tabular-nums">
                {tab.count}
              </span>
            </button>
          );
        })}
      </div>

      <div
        id={`search-panel-${activeTab}`}
        role="tabpanel"
        aria-labelledby={`search-tab-${activeTab}`}
        className="mt-4"
      >
        {activeTab === "threads" && (
          threads.length > 0 ? (
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
          ) : (
            <EmptyState title="没有匹配的主题帖" description="可以查看其他分类" />
          )
        )}

        {activeTab === "posts" && (
          posts.length > 0 ? (
            <div className="space-y-3">
              {posts.map((post) => (
                <Link
                  key={post.id}
                  href={getPostHref({ threadId: post.thread.id, postId: post.id })}
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
          ) : (
            <EmptyState title="没有匹配的楼层内容" description="可以查看其他分类" />
          )
        )}

        {activeTab === "users" && (
          users.length > 0 ? (
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
          ) : (
            <EmptyState title="没有匹配的用户" description="可以查看其他分类" />
          )
        )}
      </div>
    </div>
  );
}
