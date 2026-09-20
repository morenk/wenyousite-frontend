import { AuditPanel } from "@/components/admin/audit-panel";
import { StationFrame } from "@/components/admin/station-frame";

export default function StationAuditPage() {
  return (
    <StationFrame title="操作日志">
      <AuditPanel />
    </StationFrame>
  );
}
