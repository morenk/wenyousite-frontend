import { AnnouncementsPanel } from "@/components/admin/announcements-panel";
import { StationFrame } from "@/components/admin/station-frame";

export default function StationAnnouncementsPage() {
  return (
    <StationFrame title="站内通知" eyebrow="运营配置">
      <AnnouncementsPanel />
    </StationFrame>
  );
}
