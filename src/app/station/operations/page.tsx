import { HighRiskGate } from "@/components/admin/high-risk-gate";
import { OperationsSettingsPanel } from "@/components/admin/operations-settings-panel";
import { StationFrame } from "@/components/admin/station-frame";

export default function StationOperationsPage() {
  return (
    <StationFrame title="运行与紧急开关" eyebrow="运营配置">
      <HighRiskGate><OperationsSettingsPanel /></HighRiskGate>
    </StationFrame>
  );
}
