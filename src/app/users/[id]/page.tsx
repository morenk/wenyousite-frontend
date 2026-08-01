/** 用户主页：资料卡 + 最近动态 + 参与的帖子 */

"use client";

import { useParams } from "next/navigation";
import { Loader2, AlertCircle } from "lucide-react";
import { useUserProfile } from "@/api/hooks/use-user-profile";
import { useUserRecentReplies } from "@/api/hooks/use-user-recent-replies";
import { UserProfileCard } from "@/components/user/user-profile-card";
import { UserRecentReplies } from "@/components/user/user-recent-replies";
import { UserPlayedThreads } from "@/components/user/user-played-threads";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/shared/empty-state";

export default function UserProfilePage() {
  const params = useParams();
  const userId = params.id as string;

  const {
    data: profile,
    isLoading,
    error,
    refetch,
  } = useUserProfile(userId);

  const {
    data: replies,
    isLoading: repliesLoading,
    isError: repliesError,
  } = useUserRecentReplies(userId);

  if (isLoading) {
    return (
      <div className="flex min-h-[calc(100vh-3.5rem)] items-center justify-center">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
          加载中…
        </div>
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-12">
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
      </div>
    );
  }

  if (profile.isDeactivated) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-12">
        <Card>
          <CardContent className="pt-6">
            <EmptyState
              title="已注销用户"
              description="该用户已注销账号"
            />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <div className="space-y-5">
        <UserProfileCard user={profile} />

        <Card>
          <CardHeader>
            <CardTitle className="text-base">最近动态</CardTitle>
          </CardHeader>
          <CardContent>
            <UserRecentReplies
              replies={replies ?? []}
              isLoading={repliesLoading}
              error={repliesError}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">参与的帖子</CardTitle>
          </CardHeader>
          <CardContent>
            <UserPlayedThreads userId={userId} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
