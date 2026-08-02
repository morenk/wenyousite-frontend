/** 用户关注列表页 */

"use client";

import { useParams } from "next/navigation";
import { FollowListPage } from "@/components/user/follow-list-page";

export default function UserFollowingPage() {
  const params = useParams();
  return <FollowListPage userId={params.id as string} kind="following" />;
}
