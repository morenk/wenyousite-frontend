/** 搜索页：输入框（URL ?q= 同步）+ 搜索结果 */

"use client";

import { Suspense, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2, Search } from "lucide-react";
import { SearchResults } from "@/components/search/search-results";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

function SearchPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const q = searchParams.get("q") ?? "";
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const value = inputRef.current?.value.trim() ?? "";
    router.replace(value ? `/search?q=${encodeURIComponent(value)}` : "/search");
  };

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <form onSubmit={handleSubmit} className="mb-6 flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            key={q}
            defaultValue={q}
            ref={inputRef}
            placeholder="搜索用户、主题帖标题或楼层内容…"
            className="pl-9"
          />
        </div>
        <Button type="submit">搜索</Button>
      </form>

      {!q.trim() ? (
        <EmptyState title="输入关键词开始搜索" description="支持用户名、主题帖标题与楼层内容" />
      ) : (
        <SearchResults key={q} keyword={q} />
      )}
    </div>
  );
}

export default function SearchPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[50vh] items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      }
    >
      <SearchPageInner />
    </Suspense>
  );
}
