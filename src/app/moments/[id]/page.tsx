"use client";

import { useParams } from "next/navigation";
import { MomentDetailView } from "@/components/moment/moment-detail-view";
import { PageShell } from "@/components/layout/page-shell";

export default function MomentDetailPage() {
  const params = useParams<{ id: string }>();
  return <PageShell width="feed" className="py-5"><MomentDetailView momentId={params.id} /></PageShell>;
}
