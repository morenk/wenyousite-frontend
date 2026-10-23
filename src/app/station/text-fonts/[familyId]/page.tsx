import { StationFrame } from "@/components/admin/station-frame";
import { TextFontDetail } from "@/components/admin/text-font-detail";
export default async function TextFontDetailPage({
  params, searchParams,
}: {
  params: Promise<{ familyId: string }>;
  searchParams: Promise<{ submission?: string }>;
}) {
  const { familyId } = await params;
  const { submission } = await searchParams;
  const submissionId = submission && /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(submission) ? submission : undefined;
  return (
    <StationFrame title={familyId === "new" ? "上传字体" : "字体管理"}>
      <TextFontDetail submissionId={submissionId} familyId={familyId === "new" ? undefined : familyId} />
    </StationFrame>
  );
}
