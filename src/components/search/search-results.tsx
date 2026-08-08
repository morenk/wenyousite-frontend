/** 搜索结果展示：三个 Tab 独立惰性加载，楼层支持游标分页。 */

"use client";

import { useState, type KeyboardEvent } from "react";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { zhCN } from "date-fns/locale";
import { FileText, Loader2, MessageSquare, Users } from "lucide-react";
import {
  isPostSearchKeywordValid,
  useSearchPosts,
  useSearchThreads,
  useSearchUsers,
} from "@/api/hooks/use-search";
import { cn } from "@/lib/utils";
import { ThreadCategoryBadge } from "@/components/thread/thread-category";
import { EmptyState } from "@/components/shared/empty-state";
import { UserAvatar } from "@/components/shared/user-avatar";
import { Button } from "@/components/ui/button";
import { PostSearchResultList } from "@/components/search/post-search-result-list";

type SearchTab = "threads" | "posts" | "users";

const tabOrder: SearchTab[] = ["threads", "posts", "users"];

interface SearchResultsProps {
  keyword: string;
}

interface SearchErrorProps {
  onRetry: () => void;
}

function SearchLoading() {
  return (
    <div className="flex items-center justify-center py-16">
      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
    </div>
  );
}

function SearchError({ onRetry }: SearchErrorProps) {
  return (
    <div className="flex flex-col items-center gap-4 py-12">
      <EmptyState title="搜索失败" description="请稍后重试" />
      <Button variant="outline" size="sm" onClick={onRetry}>
        重试
      </Button>
    </div>
  );
}

export function SearchResults({ keyword }: SearchResultsProps) {
  const [activeTab, setActiveTab] = useState<SearchTab>("threads");
  const postKeywordValid = isPostSearchKeywordValid(keyword);
  const threadsQuery = useSearchThreads(keyword, activeTab === "threads");
  const usersQuery = useSearchUsers(keyword, activeTab === "users");
  const postsQuery = useSearchPosts(
    keyword,
    activeTab === "posts" && postKeywordValid,
  );
  const posts = postsQuery.data?.pages.flatMap((page) => page.data) ?? [];

  const tabs = [
    {
      value: "threads" as const,
      label: "主题帖",
      count: threadsQuery.data?.length,
      hasMore: threadsQuery.data?.length === 50,
      icon: MessageSquare,
    },
    {
      value: "posts" as const,
      label: "楼层内容",
      count: postsQuery.data ? posts.length : undefined,
      hasMore: postsQuery.hasNextPage,
      icon: FileText,
    },
    {
      value: "users" as const,
      label: "用户",
      count: usersQuery.data?.length,
      hasMore: usersQuery.data?.length === 20,
      icon: Users,
    },
  ];

  const handleTabKeyDown = (
    event: KeyboardEvent<HTMLButtonElement>,
    index: number,
  ) => {
    let nextIndex: number | undefined;
    if (event.key === "ArrowRight") nextIndex = (index + 1) % tabOrder.length;
    if (event.key === "ArrowLeft") {
      nextIndex = (index - 1 + tabOrder.length) % tabOrder.length;
    }
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
          const countSuffix = tab.count === undefined
            ? ""
            : ` ${tab.count}${tab.hasMore ? "+" : ""}`;
          return (
            <button
              key={tab.value}
              id={`search-tab-${tab.value}`}
              type="button"
              role="tab"
              aria-label={`${tab.label}${countSuffix}`}
              aria-selected={isActive}
              aria-controls={`search-panel-${tab.value}`}
              tabIndex={isActive ? 0 : -1}
              onClick={() => setActiveTab(tab.value)}
              onKeyDown={(event) => handleTabKeyDown(event, index)}
              className={cn(
                "flex min-w-0 items-center justify-center gap-1.5 rounded-lg px-2 py-2 text-xs font-medium transition-colors sm:text-sm",
                isActive
                  ? "bg-background text-foreground ring-1 ring-border"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span className="truncate">{tab.label}</span>
              {tab.count !== undefined && (
                <span className="rounded-full bg-muted-foreground/10 px-1.5 text-[11px] tabular-nums">
                  {tab.count}{tab.hasMore ? "+" : ""}
                </span>
              )}
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
          threadsQuery.isLoading ? (
            <SearchLoading />
          ) : threadsQuery.isError ? (
            <SearchError onRetry={() => void threadsQuery.refetch()} />
          ) : !threadsQuery.data || threadsQuery.data.length === 0 ? (
            <EmptyState title="没有匹配的主题帖" description="可以查看其他分类" />
          ) : (
            <div className="space-y-3">
              {threadsQuery.data.map((thread) => (
                <Link
                  key={thread.id}
                  href={`/threads/${thread.id}`}
                  className="block rounded-2xl border border-border bg-card p-4 transition-colors hover:bg-accent/20"
                >
                  <div className="mb-1.5 flex items-center gap-2">
                    <ThreadCategoryBadge category={thread.category} />
                  </div>
                  <h3 className="font-display text-base font-bold text-foreground line-clamp-1">
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
          )
        )}

        {activeTab === "posts" && (
          !postKeywordValid ? (
            <EmptyState
              title="楼层内容搜索至少需要 2 个字符"
              description="用户名和主题帖仍支持单字符搜索"
            />
          ) : postsQuery.isLoading ? (
            <SearchLoading />
          ) : postsQuery.isError ? (
            <SearchError onRetry={() => void postsQuery.refetch()} />
          ) : posts.length === 0 ? (
            <EmptyState title="没有匹配的楼层内容" description="可以查看其他分类" />
          ) : (
            <PostSearchResultList
              posts={posts}
              hasNextPage={!!postsQuery.hasNextPage}
              isFetchingNextPage={postsQuery.isFetchingNextPage}
              onLoadMore={() => void postsQuery.fetchNextPage()}
            />
          )
        )}

        {activeTab === "users" && (
          usersQuery.isLoading ? (
            <SearchLoading />
          ) : usersQuery.isError ? (
            <SearchError onRetry={() => void usersQuery.refetch()} />
          ) : !usersQuery.data || usersQuery.data.length === 0 ? (
            <EmptyState title="没有匹配的用户" description="可以查看其他分类" />
          ) : (
            <div className="space-y-3">
              {usersQuery.data.map((user) => (
                <Link
                  key={user.id}
                  href={`/users/${user.id}`}
                  className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4 transition-colors hover:bg-accent/20"
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
          )
        )}
      </div>
    </div>
  );
}
