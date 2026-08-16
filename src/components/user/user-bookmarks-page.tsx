"use client";

import { EmptyState } from "@/components/shared/empty-state";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CreateBookmarkFolderButton } from "@/components/user/create-bookmark-folder-button";
import { UserBookmarksSection } from "@/components/user/user-bookmarks-section";
import { useUserProfilePageContext } from "@/components/user/user-profile-shell";

/** 用户收藏页：无查看权限时不挂载收藏查询。 */
export function UserBookmarksPage({ userId }: { userId: string }) {
  const { canViewBookmarks, isSelf } = useUserProfilePageContext();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">收藏</CardTitle>
        {canViewBookmarks && isSelf ? (
          <CardAction>
            <CreateBookmarkFolderButton />
          </CardAction>
        ) : null}
      </CardHeader>
      <CardContent>
        {canViewBookmarks ? (
          <UserBookmarksSection userId={userId} />
        ) : (
          <EmptyState title="该用户未公开收藏" />
        )}
      </CardContent>
    </Card>
  );
}
