import { AuditPanel } from "@/components/admin/audit-panel";
import { StationFrame } from "@/components/admin/station-frame";

export default function StationAuditPage() {
  return (
    <StationFrame title="决定轨迹" eyebrow="安全与权限">
      <AuditPanel />
    </StationFrame>
  );
}
