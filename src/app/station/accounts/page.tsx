import { AdminAccountsPanel } from "@/components/admin/admin-accounts-panel";
import { HighRiskGate } from "@/components/admin/high-risk-gate";
import { StationFrame } from "@/components/admin/station-frame";

export default function StationAccountsPage() {
  return (
    <StationFrame title="站务账号" eyebrow="安全与权限">
      <HighRiskGate><AdminAccountsPanel /></HighRiskGate>
    </StationFrame>
  );
}
