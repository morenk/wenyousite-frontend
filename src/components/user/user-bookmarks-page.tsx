"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { EmptyState } from "@/components/shared/empty-state";
import { Card, CardContent } from "@/components/ui/card";
import { CreateBookmarkFolderButton } from "@/components/user/create-bookmark-folder-button";
import { UserBookmarksSection } from "@/components/user/user-bookmarks-section";
import { UserMomentBookmarksSection } from "@/components/user/user-moment-bookmarks-section";
import { useUserProfilePageContext } from "@/components/user/user-profile-shell";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { buttonVariants } from "@/components/ui/button";

/** 用户收藏页：无查看权限时不挂载收藏查询。 */
export function UserBookmarksPage({ userId }: { userId: string }) {
  const router = useRouter();
  const { canViewBookmarks, isSelf } = useUserProfilePageContext();
  const [tab, setTab] = useState<"threads" | "moments">("threads");

  return (
    <Card>
      <CardContent>
        {canViewBookmarks ? (
          <>
            <div className="mb-5 flex items-center justify-between gap-4">
              <Tabs
                value={tab}
                onValueChange={(value) => setTab(value as "threads" | "moments")}
                className="gap-0"
              >
                <TabsList variant="line" aria-label="公开收藏类型" className="h-10 p-0">
                  <TabsTrigger value="threads" className="px-3">主题帖</TabsTrigger>
                  <TabsTrigger value="moments" className="px-3">动态</TabsTrigger>
                </TabsList>
              </Tabs>
              {isSelf ? (
                <div className="flex items-center gap-2">
                  <Link href={`/bookmarks?type=${tab}`} className={buttonVariants({ variant: "outline", size: "compact" })}>
                    我的收藏夹
                  </Link>
                  <CreateBookmarkFolderButton kind={tab} onCreated={(folder) => {
                    router.push(`/bookmarks?${new URLSearchParams({ type: tab, folder: folder.id })}`);
                  }} />
                </div>
              ) : null}
            </div>
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
