"use client";

import { EmptyState } from "@/components/shared/empty-state";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { UserBookmarksSection } from "@/components/user/user-bookmarks-section";
import { useUserProfilePageContext } from "@/components/user/user-profile-shell";

/** 用户收藏页：无查看权限时不挂载收藏查询。 */
export function UserBookmarksPage({ userId }: { userId: string }) {
  const { canViewBookmarks } = useUserProfilePageContext();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">收藏</CardTitle>
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
