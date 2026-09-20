import { StationFrame } from "@/components/admin/station-frame";
import { UsersPanel } from "@/components/admin/users-panel";

export default function StationUsersPage() {
  return (
    <StationFrame title="用户管理">
      <UsersPanel />
    </StationFrame>
  );
}
