/** 用户帖子 Tab 路由。 */

"use client";

import { useParams } from "next/navigation";
import { UserThreadsPage } from "@/components/user/user-threads-page";

export default function UserThreadsRoute() {
  const params = useParams();
  return <UserThreadsPage userId={params.id as string} />;
}
