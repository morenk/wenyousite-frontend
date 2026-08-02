/** 用户粉丝列表页 */

"use client";

import { useParams } from "next/navigation";
import { FollowListPage } from "@/components/user/follow-list-page";

export default function UserFollowersPage() {
  const params = useParams();
  return <FollowListPage userId={params.id as string} kind="followers" />;
}
