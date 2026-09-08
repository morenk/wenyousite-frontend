import { CaseWorkbench } from "@/components/admin/case-workbench";
import { StationFrame } from "@/components/admin/station-frame";

export default function StationCasesPage() {
  return (
    <StationFrame title="案件工作台" fullBleed>
      <CaseWorkbench />
    </StationFrame>
  );
}
