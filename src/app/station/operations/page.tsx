import { HighRiskGate } from "@/components/admin/high-risk-gate";
import { OperationsSettingsPanel } from "@/components/admin/operations-settings-panel";
import { StationFrame } from "@/components/admin/station-frame";

export default function StationOperationsPage() {
  return (
    <StationFrame title="运行设置">
      <HighRiskGate><OperationsSettingsPanel /></HighRiskGate>
    </StationFrame>
  );
}
