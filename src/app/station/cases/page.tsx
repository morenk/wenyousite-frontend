import { CaseWorkbench } from "@/components/admin/case-workbench";
import { StationFrame } from "@/components/admin/station-frame";

export default function StationCasesPage() {
  return (
    <StationFrame title="举报处理" fullBleed>
      <CaseWorkbench />
    </StationFrame>
  );
}
