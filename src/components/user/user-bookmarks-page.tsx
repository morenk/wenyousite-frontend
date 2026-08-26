"use client";

import { useState } from "react";
import { EmptyState } from "@/components/shared/empty-state";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CreateBookmarkFolderButton } from "@/components/user/create-bookmark-folder-button";
import { UserBookmarksSection } from "@/components/user/user-bookmarks-section";
import { UserMomentBookmarksSection } from "@/components/user/user-moment-bookmarks-section";
import { useUserProfilePageContext } from "@/components/user/user-profile-shell";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

/** 用户收藏页：无查看权限时不挂载收藏查询。 */
export function UserBookmarksPage({ userId }: { userId: string }) {
  const { canViewBookmarks, isSelf } = useUserProfilePageContext();
  const [tab, setTab] = useState<"threads" | "moments">("threads");

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">收藏</CardTitle>
        {canViewBookmarks && isSelf ? (
          <CardAction>
            <CreateBookmarkFolderButton kind={tab} />
          </CardAction>
        ) : null}
      </CardHeader>
      <CardContent>
        {canViewBookmarks ? (
          <>
            <Tabs
              value={tab}
              onValueChange={(value) => setTab(value as "threads" | "moments")}
              className="mb-5 gap-0"
            >
              <TabsList variant="line" aria-label="公开收藏类型" className="h-10 p-0">
                <TabsTrigger value="threads" className="px-3">主题帖</TabsTrigger>
                <TabsTrigger value="moments" className="px-3">动态</TabsTrigger>
              </TabsList>
            </Tabs>
            {tab === "threads" ? (
              <UserBookmarksSection userId={userId} />
            ) : (
              <UserMomentBookmarksSection userId={userId} />
            )}
          </>
        ) : (
          <EmptyState title="该用户未公开收藏" />
        )}
      </CardContent>
    </Card>
  );
}
