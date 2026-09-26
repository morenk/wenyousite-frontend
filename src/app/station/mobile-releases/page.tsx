import { MobileReleasesPanel } from "@/components/admin/mobile-releases-panel";
import { StationFrame } from "@/components/admin/station-frame";

export default function StationMobileReleasesPage() {
  return <StationFrame title="移动端版本"><MobileReleasesPanel /></StationFrame>;
}
