/** 搜索页：输入框（URL ?q= 同步）+ 搜索结果 */

"use client";

import { Suspense, useRef } from "react";
import { useQueryState } from "nuqs";
import { Search } from "lucide-react";
import { SearchResults } from "@/components/search/search-results";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageShell } from "@/components/layout/page-shell";
import { PageRouteFallback } from "@/components/layout/page-route-fallback";
import { searchQueryParser } from "@/lib/url-state";
import { PageHeader } from "@/components/layout/page-header";

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
    <PageShell width="feed">
      <PageHeader
        title="搜索"
        variant="compact"
        toolbar={
          <form onSubmit={handleSubmit} className="flex items-center gap-2" role="search">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                key={q}
                defaultValue={q}
                ref={inputRef}
                placeholder="搜索动态、用户、主题帖或楼层内容…"
                className="pl-9"
              />
            </div>
            <Button type="submit">搜索</Button>
          </form>
        }
      />

      {q.trim() ? <SearchResults keyword={q} /> : null}
    </PageShell>
  );
}

export default function SearchPage() {
  return (
    <Suspense
      fallback={<PageRouteFallback variant="feed" />}
    >
      <SearchPageInner />
    </Suspense>
  );
}
