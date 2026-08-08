"use client";

import { useParams, useRouter } from "next/navigation";
import { MomentDetailView } from "@/components/moment/moment-detail-view";

export default function MomentDetailModal() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-5 backdrop-blur-[1px]" role="dialog" aria-modal="true" aria-label="动态详情" onMouseDown={(event) => { if (event.target === event.currentTarget) router.back(); }}>
      <div className="w-full max-w-[36rem] overflow-hidden rounded-3xl bg-background shadow-dialog">
        <div data-slot="moment-detail-scroll" className="moment-detail-scroll max-h-[92vh] overflow-y-auto overscroll-contain">
          <MomentDetailView momentId={params.id} modal onClose={() => router.back()} />
        </div>
      </div>
    </div>
  );
}
