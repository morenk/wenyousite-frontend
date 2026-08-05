/** 主题帖详情内的楼层搜索面板，覆盖全部子贴并复用全站搜索结果列表。 */

"use client";

import { useState, type FormEvent } from "react";
import { Loader2, X } from "lucide-react";
import {
  isPostSearchKeywordValid,
  useThreadSearchPosts,
} from "@/api/hooks/use-search";
import { EmptyState } from "@/components/shared/empty-state";
import { PostSearchResultList } from "@/components/search/post-search-result-list";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";

interface ThreadPostSearchProps {
  threadId: string;
  onClose: () => void;
  onSelect?: () => void;
}

export function ThreadPostSearch({
  threadId,
  onClose,
  onSelect,
}: ThreadPostSearchProps) {
  const [input, setInput] = useState("");
  const [keyword, setKeyword] = useState<string>();
  const keywordValid = keyword !== undefined
    && isPostSearchKeywordValid(keyword);
  const postsQuery = useThreadSearchPosts(threadId, keyword ?? "", keywordValid);
  const posts = postsQuery.data?.pages.flatMap((page) => page.data) ?? [];

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setKeyword(input.trim());
  };

  return (
    <Card aria-label="帖内楼层搜索">
      <CardHeader className="border-b">
        <CardTitle>搜索本帖楼层</CardTitle>
        <CardDescription>搜索范围包含本帖全部子贴和楼中楼</CardDescription>
        <CardAction>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="关闭帖内搜索"
            onClick={onClose}
          >
            <X className="h-4 w-4" />
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent className="space-y-4">
        <form className="flex gap-2" role="search" onSubmit={handleSubmit}>
          <Input
            type="search"
            role="searchbox"
            aria-label="搜索本帖楼层关键词"
            placeholder="输入至少 2 个字符"
            value={input}
            onChange={(event) => setInput(event.target.value)}
            autoFocus
          />
          <Button type="submit">搜索</Button>
        </form>

        {keyword === undefined ? (
          <p className="py-2 text-center text-sm text-muted-foreground">
            输入关键词，查找当前主题帖中的发言
          </p>
        ) : !keywordValid ? (
          <p role="alert" className="py-2 text-center text-sm text-muted-foreground">
            请输入至少 2 个字符
          </p>
        ) : postsQuery.isLoading ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : postsQuery.isError ? (
          <div className="flex flex-col items-center gap-3 py-6">
            <EmptyState title="搜索失败" description="请稍后重试" />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void postsQuery.refetch()}
            >
              重试
            </Button>
          </div>
        ) : posts.length === 0 ? (
          <EmptyState title="本帖没有匹配的楼层" description="可以换个关键词试试" />
        ) : (
          <PostSearchResultList
            posts={posts}
            context="thread"
            hasNextPage={!!postsQuery.hasNextPage}
            isFetchingNextPage={postsQuery.isFetchingNextPage}
            onLoadMore={() => void postsQuery.fetchNextPage()}
            onSelect={onSelect}
          />
        )}
      </CardContent>
    </Card>
  );
}
