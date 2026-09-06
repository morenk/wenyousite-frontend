"use client";

import { useEffect, useRef } from "react";
import { parseAsString, parseAsStringLiteral, useQueryStates } from "nuqs";
import { BookmarkList } from "@/components/user/bookmark-list";
import { PageHeader } from "@/components/layout/page-header";
import { PageShell } from "@/components/layout/page-shell";
import { useMomentBookmarks } from "@/api/hooks/use-moments";
import { MomentMasonry } from "@/components/moment/moment-masonry";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/lib/auth";
import { useBookmarkFolders, type BookmarkFolder, type BookmarkFolderKind } from "@/api/hooks/use-bookmark-folders";
import { BookmarkFolderBar } from "@/components/user/bookmark-folder-bar";
import { LoadError } from "@/components/shared/load-error";
import { Skeleton } from "@/components/ui/skeleton";
import { BookmarkMomentCard } from "@/components/user/bookmark-moment-card";
import { WenyouCount } from "@/components/shared/wenyou-count";

export default function BookmarksPage() {
  const [{ type, folder }, setLocation] = useQueryStates({
    type: parseAsStringLiteral(["threads", "moments"]).withDefault("threads"),
    folder: parseAsString,
  }, { history: "push", scroll: false });
  const remembered = useRef<Partial<Record<BookmarkFolderKind, string | null>>>({});
  const foldersQuery = useBookmarkFolders(type);
  const folders = foldersQuery.data ?? [];
  const selected = folders.find((item) => item.id === folder);
  const invalidFolder = !!folder && !!foldersQuery.data && !foldersQuery.isError && !selected;
  const folderId = invalidFolder ? undefined : folder ?? undefined;

  useEffect(() => {
    if (invalidFolder) void setLocation({ folder: null }, { history: "replace" });
  }, [invalidFolder, setLocation]);

  return (
    <PageShell width="workspace">
      <PageHeader title="我的收藏" />
      <div className="grid grid-cols-[15rem_minmax(0,1fr)] items-start gap-6">
        <aside className="sticky top-5 flex h-[calc(100dvh-7rem)] min-h-64 flex-col gap-4 border-r border-border pr-5" aria-label="收藏目录">
          <Tabs value={type} onValueChange={(value) => {
            remembered.current[type] = folderId ?? null;
            void setLocation({ type: value as BookmarkFolderKind, folder: remembered.current[value as BookmarkFolderKind] ?? null });
          }} className="gap-0">
            <TabsList variant="line" aria-label="收藏分类" className="h-10 w-full p-0">
              <TabsTrigger value="threads" className="flex-1">主题帖</TabsTrigger>
              <TabsTrigger value="moments" className="flex-1">动态</TabsTrigger>
            </TabsList>
          </Tabs>
          {foldersQuery.isLoading ? <Skeleton className="h-64 w-full rounded-xl" /> : foldersQuery.isError ? (
            <LoadError title="收藏夹加载失败" onRetry={() => void foldersQuery.refetch()} className="px-0 py-6" />
          ) : (
            <BookmarkFolderBar key={type} folders={folders} selectedFolderId={folderId} onSelect={(id) => void setLocation({ folder: id ?? null })} kind={type} />
          )}
        </aside>
        <section className="min-w-0" aria-label="收藏内容">
          <div className="mb-2 flex min-h-10 items-start justify-between gap-4 border-b border-border pb-4">
            <h2 className="min-w-0 break-words font-display text-xl">{selected?.name ?? "全部收藏"}</h2>
            {foldersQuery.data && !foldersQuery.isError ? <span className="shrink-0 pt-1 text-sm text-muted-foreground"><WenyouCount value={selected?.itemCount ?? folders.reduce((sum, item) => sum + item.itemCount, 0)} label="收藏数量" /> 条</span> : null}
          </div>
          {type === "threads" ? <BookmarkList folderId={folderId} folders={folders} /> : <MomentBookmarks folderId={folderId} folders={folders} />}
        </section>
      </div>
    </PageShell>
  );
}

function MomentBookmarks({ folderId, folders }: { folderId?: string; folders: BookmarkFolder[] }) {
  const { user } = useAuth();
  const query = useMomentBookmarks(user?.id, folderId);
  return <MomentMasonry moments={query.data?.pages.flatMap((page) => page.data) ?? []} maxLanes={3}
    isLoading={query.isLoading} error={query.error} hasNextPage={!!query.hasNextPage} isFetchingNextPage={query.isFetchingNextPage}
    onLoadMore={() => void query.fetchNextPage()} onRetry={() => void query.refetch()}
    emptyTitle={folderId ? "这个收藏夹还没有动态" : "还没有收藏动态"}
    renderMoment={(moment) => <BookmarkMomentCard moment={moment as typeof moment & { bookmarkFolderId: string }} folders={folders} showFolder={!folderId} />} />;
}
