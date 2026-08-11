import { StationFrame } from "@/components/admin/station-frame";
import { TaxonomyPanel } from "@/components/admin/taxonomy-panel";

export default function StationTaxonomyPage() {
  return (
    <StationFrame title="分类与标签" eyebrow="运营配置">
      <TaxonomyPanel />
    </StationFrame>
  );
}
