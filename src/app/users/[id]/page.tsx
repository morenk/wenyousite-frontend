/** 用户主页：资料卡 + 最近动态 + 创建的帖子 + 参与的帖子 */

"use client";

import { useParams } from "next/navigation";
import { AlertCircle } from "lucide-react";
import { useUserProfile } from "@/api/hooks/use-user-profile";
import { useUserRecentReplies } from "@/api/hooks/use-user-recent-replies";
import { UserProfileCard } from "@/components/user/user-profile-card";
import { UserRecentReplies } from "@/components/user/user-recent-replies";
import { UserCreatedThreads } from "@/components/user/user-created-threads";
import { UserPlayedThreads } from "@/components/user/user-played-threads";
import { UserBookmarksSection } from "@/components/user/user-bookmarks-section";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/shared/empty-state";
import { useAuth } from "@/lib/auth";
import { PageShell } from "@/components/layout/page-shell";
import { PageRouteFallback } from "@/components/layout/page-route-fallback";
import { UserMomentsSection } from "@/components/moment/user-moments-section";

function RecentRepliesCard({ userId }: { userId: string }) {
  const {
    data: replies,
    isLoading,
    isError,
  } = useUserRecentReplies(userId);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">最近回复</CardTitle>
      </CardHeader>
      <CardContent>
        <UserRecentReplies
          replies={replies ?? []}
          isLoading={isLoading}
          error={isError}
        />
      </CardContent>
    </Card>
  );
}

export default function UserProfilePage() {
  const params = useParams();
  const userId = params.id as string;
  const { user } = useAuth();

  const {
    data: profile,
    isLoading,
    error,
    refetch,
  } = useUserProfile(userId);

  if (isLoading) {
    return <PageRouteFallback variant="profile" />;
  }

  if (error || !profile) {
    return (
      <PageShell className="py-12">
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col items-center gap-4 py-8">
              <AlertCircle className="h-10 w-10 text-muted-foreground" />
              <EmptyState
                title="用户不存在"
                description="该用户可能已注销或不存在"
              />
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => refetch()}>
                  重试
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </PageShell>
    );
  }

  if (profile.isDeactivated) {
    return (
      <PageShell className="py-12">
        <Card>
          <CardContent className="pt-6">
            <EmptyState
              title="已注销用户"
              description="该用户已注销账号"
            />
          </CardContent>
        </Card>
      </PageShell>
    );
  }

  const isSelf = user?.id === userId;
  const canViewRecentReplies = isSelf || profile.showRecentReplies;
  const canViewBookmarks = isSelf || profile.showBookmarks;
  const canViewPlayedThreads = isSelf || profile.showPlayerBadges;

  return (
    <PageShell>
      <div className="space-y-5">
        <UserProfileCard user={profile} />

        <Card>
          <CardHeader>
            <CardTitle className="text-base">动态</CardTitle>
          </CardHeader>
          <CardContent>
            <UserMomentsSection userId={userId} />
          </CardContent>
        </Card>

        {canViewRecentReplies && <RecentRepliesCard userId={userId} />}

        <Card>
          <CardHeader>
            <CardTitle className="text-base">创建的帖子</CardTitle>
          </CardHeader>
          <CardContent>
            <UserCreatedThreads userId={userId} />
          </CardContent>
        </Card>

        {canViewBookmarks && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">收藏</CardTitle>
            </CardHeader>
            <CardContent>
              <UserBookmarksSection userId={userId} />
            </CardContent>
          </Card>
        )}

        {canViewPlayedThreads && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">参与的帖子</CardTitle>
            </CardHeader>
            <CardContent>
              <UserPlayedThreads userId={userId} isSelf={isSelf} />
            </CardContent>
          </Card>
        )}
      </div>
    </PageShell>
  );
}
