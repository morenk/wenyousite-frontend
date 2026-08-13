/** 用户主页概览：创作汇总 + 可见的最近回复。 */

"use client";

import { useParams } from "next/navigation";
import { useUserRecentReplies } from "@/api/hooks/use-user-recent-replies";
import { UserRecentReplies } from "@/components/user/user-recent-replies";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { UserActivitySummaryCard } from "@/components/user/user-activity-summary";
import { useUserProfilePageContext } from "@/components/user/user-profile-shell";

function RecentRepliesCard({ userId }: { userId: string }) {
  const {
    data: replies,
    isLoading,
    isError,
  } = useUserRecentReplies(userId);

  return (
    <Card id="recent-replies" className="scroll-mt-20">
      <CardHeader>
        <CardTitle className="text-base">最近回复</CardTitle>
      </CardHeader>
      <CardContent>
        <UserRecentReplies replies={replies ?? []} isLoading={isLoading} error={isError} />
      </CardContent>
    </Card>
  );
}

export default function UserProfilePage() {
  const params = useParams();
  const userId = params.id as string;
  const { canViewRecentReplies } = useUserProfilePageContext();

  return (
    <div className="space-y-5">
      <UserActivitySummaryCard userId={userId} />
      {canViewRecentReplies ? <RecentRepliesCard userId={userId} /> : null}
    </div>
  );
}
