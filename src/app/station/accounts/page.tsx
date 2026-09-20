import { AdminAccountsPanel } from "@/components/admin/admin-accounts-panel";
import { HighRiskGate } from "@/components/admin/high-risk-gate";
import { StationFrame } from "@/components/admin/station-frame";

export default function StationAccountsPage() {
  return (
    <StationFrame title="管理员账号">
      <HighRiskGate><AdminAccountsPanel /></HighRiskGate>
    </StationFrame>
  );
}
