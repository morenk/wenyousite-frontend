import { notFound } from "next/navigation";
import { StationFrame } from "@/components/admin/station-frame";
import { ContentDetailPanel } from "@/components/admin/content-detail-panel";
import type { AdminContentType } from "@/api/admin-types";

export default async function StationContentDetailPage({ params }: { params: Promise<{ type: string; id: string }> }) {
  const { type, id } = await params;
  if (!["thread", "post", "moment", "moment_comment"].includes(type)) notFound();
  return <StationFrame title="内容详情"><ContentDetailPanel type={type as AdminContentType} id={id} /></StationFrame>;
}
