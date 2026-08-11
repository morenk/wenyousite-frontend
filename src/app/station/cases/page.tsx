import { CaseWorkbench } from "@/components/admin/case-workbench";
import { StationFrame } from "@/components/admin/station-frame";

export default function StationCasesPage() {
  return (
    <StationFrame title="案件工作台" eyebrow="内容治理" fullBleed>
      <CaseWorkbench />
    </StationFrame>
  );
}
