/** 用户全部动态路由。 */

"use client";

import { useParams } from "next/navigation";
import { UserMomentsPage } from "@/components/moment/user-moments-page";

export default function UserMomentsRoute() {
  const params = useParams();
  return <UserMomentsPage userId={params.id as string} />;
}
