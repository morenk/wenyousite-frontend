import { ContentModerationPanel } from "@/components/admin/content-moderation-panel";
import { StationFrame } from "@/components/admin/station-frame";

export default function StationContentPage() {
  return (
    <StationFrame title="内容处置" eyebrow="内容治理">
      <ContentModerationPanel />
    </StationFrame>
  );
}
