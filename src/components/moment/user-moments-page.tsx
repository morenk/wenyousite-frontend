import { UserMomentsSection } from "@/components/moment/user-moments-section";

/** 用户全部动态内容：保留游标分页和虚拟瀑布流，不挤占个人主页。 */
export function UserMomentsPage({ userId }: { userId: string }) {
  return <UserMomentsSection userId={userId} />;
}
