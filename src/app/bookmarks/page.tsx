/** 我的收藏管理页 */

"use client";

import { BookmarkList } from "@/components/user/bookmark-list";
import { PageHeader } from "@/components/layout/page-header";
import { PageShell } from "@/components/layout/page-shell";

export default function BookmarksPage() {
  return (
    <PageShell width="feed">
      <PageHeader title="我的收藏" description="稍后继续阅读或参与的主题帖。" />
      <BookmarkList />
    </PageShell>
  );
}
