/** 标签主题帖页：按稳定标签 ID 展示公开已发布主题帖。 */

"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, Loader2 } from "lucide-react";
import { useState } from "react";
import { useTag } from "@/api/hooks/use-tags";
import {
  useThreads,
  type ThreadSort,
  type ThreadStatusFilter,
} from "@/api/hooks/use-threads";
import { CategoryTabs } from "@/components/thread/category-tabs";
import { ThreadFilters } from "@/components/thread/thread-filters";
import { ThreadList } from "@/components/thread/thread-list";
import { EmptyState } from "@/components/shared/empty-state";

export default function TagThreadsPage() {
  const { id: tagId } = useParams<{ id: string }>();
  const [category, setCategory] = useState<string | undefined>();
  const [sort, setSort] = useState<ThreadSort>("recommended");
  const [status, setStatus] = useState<ThreadStatusFilter>();
  const tagQuery = useTag(tagId);
  const threadsQuery = useThreads({
    tagId,
    category: category as "DEDUCTION" | "NATION" | "RPG" | undefined,
    sort,
    status,
  });
  const threads =
    threadsQuery.data?.pages.flatMap((page) => page?.data ?? []) ?? [];

  if (tagQuery.isLoading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (tagQuery.error || !tagQuery.data) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10">
        <EmptyState
          title="标签不存在"
          description="该标签可能已被删除或链接有误"
        />
        <div className="mt-4 text-center">
          <Link href="/" className="text-sm text-primary hover:underline">
            返回发现
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <Link
        href="/"
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        返回发现
      </Link>

      <div className="mb-5">
        <p className="text-sm text-muted-foreground">主题帖标签</p>
        <h1 className="mt-1 text-xl font-bold text-foreground">
          #{tagQuery.data.name}
        </h1>
      </div>

      <div className="mb-5">
        <CategoryTabs selected={category} onChange={setCategory} />
      </div>

      <div className="mb-5">
        <ThreadFilters
          sort={sort}
          status={status}
          onSortChange={setSort}
          onStatusChange={setStatus}
        />
      </div>

      <ThreadList
        threads={threads}
        hasNextPage={!!threadsQuery.hasNextPage}
        isFetchingNextPage={threadsQuery.isFetchingNextPage}
        isLoading={threadsQuery.isLoading}
        error={threadsQuery.error}
        onLoadMore={() => threadsQuery.fetchNextPage()}
        onRetry={() => threadsQuery.refetch()}
      />
    </div>
  );
}
