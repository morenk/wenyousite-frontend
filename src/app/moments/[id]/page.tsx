"use client";

import { ArrowLeft } from "lucide-react";
import { useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { MomentDetailView } from "@/components/moment/moment-detail-view";
import { PageShell } from "@/components/layout/page-shell";
import { takeMomentFeedReturn } from "@/lib/moment-navigation";

export default function MomentDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const returnToMoments = useCallback(() => {
    if (takeMomentFeedReturn(params.id)) router.back();
    else router.replace("/moments");
  }, [params.id, router]);

  return (
    <PageShell width="feed" className="py-5">
      <div data-slot="moment-detail-column" className="mx-auto w-full max-w-feed">
        <div data-slot="moment-detail-toolbar" className="w-full px-5 sm:px-7">
          <button
            type="button"
            onClick={returnToMoments}
            className="inline-flex min-h-8 items-center gap-2 rounded-lg px-1 text-sm font-semibold text-muted-foreground transition-colors duration-[var(--motion-fast)] hover:text-brand-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
          >
            <ArrowLeft className="size-4" />
            返回动态
          </button>
        </div>
        <MomentDetailView momentId={params.id} onDeleted={returnToMoments} />
      </div>
    </PageShell>
  );
}
