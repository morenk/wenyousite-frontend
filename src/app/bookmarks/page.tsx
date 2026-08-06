/** 我的收藏管理页 */

"use client";

import { BookmarkList } from "@/components/user/bookmark-list";

export default function BookmarksPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <h1 className="mb-5 text-xl font-bold text-foreground">我的收藏</h1>
      <BookmarkList />
    </div>
  );
}
