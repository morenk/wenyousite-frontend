import { StationFrame } from "@/components/admin/station-frame";
import { UserDetailPanel } from "@/components/admin/user-detail-panel";

export default async function StationUserPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <StationFrame title="用户详情"><UserDetailPanel id={id} /></StationFrame>;
}
