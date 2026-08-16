"use client";

import { useSearchParams } from "next/navigation";
import { RequireAuth } from "@/components/auth/require-auth";
import { ReportForm } from "@/components/user/report-form";
import type { components } from "@/api/types";

type TargetType = components["schemas"]["CreateReportDto"]["targetType"];
const targetTypes = new Set<TargetType>(["USER", "THREAD", "POST", "MOMENT", "MOMENT_COMMENT", "DIRECT_MESSAGE"]);

export default function ReportPage() {
  const params = useSearchParams();
  const targetType = params.get("targetType") as TargetType | null;
  const targetId = params.get("targetId");
  return (
    <RequireAuth>
      {!targetType || !targetTypes.has(targetType) || !targetId ? (
        <p className="mx-auto mt-16 max-w-xl rounded-xl border border-border bg-card p-6 text-sm text-destructive">举报目标参数无效。</p>
      ) : <ReportForm targetType={targetType} targetId={targetId} />}
    </RequireAuth>
  );
}
