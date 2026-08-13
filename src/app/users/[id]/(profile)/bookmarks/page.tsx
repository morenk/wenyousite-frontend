/** 用户收藏 Tab 路由。 */

"use client";

import { useParams } from "next/navigation";
import { UserBookmarksPage } from "@/components/user/user-bookmarks-page";

export default function UserBookmarksRoute() {
  const params = useParams();
  return <UserBookmarksPage userId={params.id as string} />;
}
