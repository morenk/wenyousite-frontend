import { StationFrame } from "@/components/admin/station-frame";
import { TextFontDetail } from "@/components/admin/text-font-detail";
export default async function TextFontDetailPage({
  params,
}: {
  params: Promise<{ familyId: string }>;
}) {
  const { familyId } = await params;
  return (
    <StationFrame title={familyId === "new" ? "新建字体" : "字体管理"}>
      <TextFontDetail familyId={familyId === "new" ? undefined : familyId} />
    </StationFrame>
  );
}
