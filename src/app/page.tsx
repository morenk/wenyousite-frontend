/** 首页：主题帖列表，支持分类筛选和滚动加载 */

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useThreads } from "@/api/hooks/use-threads";
import { ThreadList } from "@/components/thread/thread-list";
import { CategoryTabs } from "@/components/thread/category-tabs";
import { Button } from "@/components/ui/button";

export default function HomePage() {
  const { user } = useAuth();
  const router = useRouter();
  const [category, setCategory] = useState<string | undefined>();

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    error,
    refetch,
  } = useThreads({
    category: category as "DEDUCTION" | "NATION" | "RPG" | undefined,
    sort: "recommended",
  });

  const threads = data?.pages.flatMap((page) => page?.data ?? []) ?? [];

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      {/* 顶部操作栏 */}
      <div className="mb-5 flex items-center justify-between">
        <h1 className="text-xl font-bold text-foreground">发现</h1>
        {user && (
          <div className="flex gap-2">
            <Button
              size="sm"
              onClick={() => router.push("/threads/create")}
            >
              <Plus className="h-4 w-4" />
              创建主题帖
            </Button>
          </div>
        )}
      </div>

      {/* 分类筛选 */}
      <div className="mb-5">
        <CategoryTabs selected={category} onChange={setCategory} />
      </div>

      {/* 帖列表 */}
      <ThreadList
        threads={threads}
        hasNextPage={!!hasNextPage}
        isFetchingNextPage={isFetchingNextPage}
        isLoading={isLoading}
        error={error}
        onLoadMore={() => fetchNextPage()}
        onRetry={() => refetch()}
      />
    </div>
  );
}
