/** 搜索页：输入框（URL ?q= 同步）+ 搜索结果 */

"use client";

import { Suspense, useRef } from "react";
import { useQueryState } from "nuqs";
import { Search } from "lucide-react";
import { SearchResults } from "@/components/search/search-results";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageShell } from "@/components/layout/page-shell";
import { LoadingState } from "@/components/shared/loading-state";
import { searchQueryParser } from "@/lib/url-state";

function SearchPageInner() {
  const [q, setQuery] = useQueryState("q", searchQueryParser.withOptions({
    history: "push",
    shallow: true,
  }));
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const value = inputRef.current?.value.trim() ?? "";
    void setQuery(value || null);
  };

  return (
    <PageShell width="md">
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
    </PageShell>
  );
}

export default function SearchPage() {
  return (
    <Suspense
      fallback={
        <LoadingState className="min-h-[50vh]" label="" />
      }
    >
      <SearchPageInner />
    </Suspense>
  );
}
