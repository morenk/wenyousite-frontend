import { AppealsPanel } from "@/components/admin/appeals-panel";
import { StationFrame } from "@/components/admin/station-frame";

export default function StationAppealsPage() {
  return (
    <StationFrame title="申诉复核">
      <AppealsPanel />
    </StationFrame>
  );
}
