import { AdminDashboardPanel } from "@/components/admin/admin-dashboard-panel";
import { StationFrame } from "@/components/admin/station-frame";

export default function StationDashboardPage() {
  return (
    <StationFrame title="站务总览" eyebrow="运行概览">
      <AdminDashboardPanel />
    </StationFrame>
  );
}
