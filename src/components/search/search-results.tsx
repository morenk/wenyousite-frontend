/** 搜索结果展示：四个 Tab 独立惰性加载，动态与楼层支持游标分页。 */

"use client";

import { useState } from "react";
import Link from "next/link";
import { FileText, Images, Loader2, MessageSquare, Users } from "lucide-react";
import {
  isPostSearchKeywordValid,
  useSearchPosts,
  useSearchThreads,
  useSearchUsers,
  useSearchMoments,
} from "@/api/hooks/use-search";
import { EmptyState } from "@/components/shared/empty-state";
import { UserAvatar } from "@/components/shared/user-avatar";
import { Button } from "@/components/ui/button";
import { PostSearchResultList } from "@/components/search/post-search-result-list";
import { ListRefreshIndicator } from "@/components/shared/list-refresh-indicator";
import { MomentMasonry } from "@/components/moment/moment-masonry";
import { useAuth } from "@/lib/auth";
import { ThreadList } from "@/components/thread/thread-list";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

type SearchTab = "moments" | "threads" | "posts" | "users";

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
      <EmptyState title="搜索失败" />
      <Button variant="outline" size="sm" onClick={onRetry}>
        重试
      </Button>
    </div>
  );
}

export function SearchResults({ keyword }: SearchResultsProps) {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<SearchTab>("moments");
  const postKeywordValid = isPostSearchKeywordValid(keyword);
  const threadsQuery = useSearchThreads(keyword, activeTab === "threads");
  const usersQuery = useSearchUsers(keyword, activeTab === "users");
  const postsQuery = useSearchPosts(
    keyword,
    activeTab === "posts" && postKeywordValid,
  );
  const momentsQuery = useSearchMoments(keyword, activeTab === "moments" && postKeywordValid, user?.id);
  const posts = postsQuery.data?.pages.flatMap((page) => page.data) ?? [];
  const threads = threadsQuery.data?.pages.flatMap((page) => page.data) ?? [];
  const moments = momentsQuery.data?.pages.flatMap((page) => page.data) ?? [];
  const isRefreshing = activeTab === "moments"
    ? momentsQuery.isPlaceholderData
    : activeTab === "threads"
    ? threadsQuery.isPlaceholderData
    : activeTab === "users"
      ? usersQuery.isPlaceholderData
      : postsQuery.isPlaceholderData;

  const tabs = [
    {
      value: "moments" as const,
      label: "动态",
      count: momentsQuery.data ? moments.length : undefined,
      hasMore: momentsQuery.hasNextPage,
      icon: Images,
    },
    {
      value: "threads" as const,
      label: "主题帖",
      count: threadsQuery.data ? threads.length : undefined,
      hasMore: threadsQuery.hasNextPage,
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

  return (
    <Tabs
      value={activeTab}
      onValueChange={(value) => setActiveTab(value as SearchTab)}
      className="relative w-full min-w-0 gap-0"
      aria-busy={isRefreshing || undefined}
    >
      {isRefreshing && activeTab !== "threads" && <ListRefreshIndicator />}
      <TabsList
        aria-label="搜索结果分类"
        className="grid h-10 w-full grid-cols-4 gap-1 rounded-xl bg-muted p-1"
      >
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const countSuffix = tab.count === undefined
            ? ""
            : ` ${tab.count}${tab.hasMore ? "+" : ""}`;
          return (
            <TabsTrigger
              key={tab.value}
              value={tab.value}
              aria-label={`${tab.label}${countSuffix}`}
              className="min-w-0 gap-1.5 rounded-lg px-2 py-2 text-xs font-medium sm:text-sm data-active:ring-1 data-active:ring-border"
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span className="truncate">{tab.label}</span>
              {tab.count !== undefined && (
                <span className="rounded-full bg-muted-foreground/10 px-1.5 text-[11px] tabular-nums">
                  {tab.count}{tab.hasMore ? "+" : ""}
                </span>
              )}
            </TabsTrigger>
          );
        })}
      </TabsList>

      <TabsContent value="moments" className="mt-4 w-full min-w-0">
        {!postKeywordValid ? (
            <EmptyState title="动态搜索至少需要 2 个字符" description="用户名和主题帖仍支持单字符搜索" />
          ) : (
            <MomentMasonry moments={moments} maxLanes={2} isLoading={momentsQuery.isLoading} error={momentsQuery.error} hasNextPage={!isRefreshing && !!momentsQuery.hasNextPage} isFetchingNextPage={!isRefreshing && momentsQuery.isFetchingNextPage} onLoadMore={() => void momentsQuery.fetchNextPage()} onRetry={() => void momentsQuery.refetch()} emptyTitle="没有匹配的动态" />
          )}
      </TabsContent>

      <TabsContent value="threads" className="mt-4 w-full min-w-0">
        <div className="block w-full">
          <ThreadList
            threads={threads}
            hasNextPage={!isRefreshing && !!threadsQuery.hasNextPage}
            isFetchingNextPage={!isRefreshing && threadsQuery.isFetchingNextPage}
            isLoading={threadsQuery.isLoading}
            isRefreshing={activeTab === "threads" && !!threadsQuery.isPlaceholderData}
            error={threadsQuery.error}
            onLoadMore={() => void threadsQuery.fetchNextPage()}
            onRetry={() => void threadsQuery.refetch()}
            emptyTitle="没有匹配的主题帖"
            errorTitle="搜索失败"
          />
        </div>
      </TabsContent>

      <TabsContent value="posts" className="mt-4 w-full min-w-0">
        {!postKeywordValid ? (
            <EmptyState
              title="楼层内容搜索至少需要 2 个字符"
              description="用户名和主题帖仍支持单字符搜索"
            />
          ) : postsQuery.isLoading ? (
            <SearchLoading />
          ) : postsQuery.isError ? (
            <SearchError onRetry={() => void postsQuery.refetch()} />
          ) : posts.length === 0 ? (
            <EmptyState title="没有匹配的楼层内容" />
          ) : (
            <PostSearchResultList
              posts={posts}
              hasNextPage={!isRefreshing && !!postsQuery.hasNextPage}
              isFetchingNextPage={!isRefreshing && postsQuery.isFetchingNextPage}
              onLoadMore={() => void postsQuery.fetchNextPage()}
            />
          )}
      </TabsContent>

      <TabsContent value="users" className="mt-4 w-full min-w-0">
        {usersQuery.isLoading ? (
            <SearchLoading />
          ) : usersQuery.isError ? (
            <SearchError onRetry={() => void usersQuery.refetch()} />
          ) : !usersQuery.data || usersQuery.data.length === 0 ? (
            <EmptyState title="没有匹配的用户" />
          ) : (
            <div className="w-full space-y-3">
              {usersQuery.data.map((user) => (
                <Link
                  key={user.id}
                  href={`/users/${user.id}`}
                  className="flex w-full items-center gap-3 rounded-2xl border border-border bg-card p-4 transition-colors hover:bg-accent/20"
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
          )}
      </TabsContent>
    </Tabs>
  );
}
