/** 通知列表页：URL ?type= 同步类型筛选，点击导航栏通知入口回到 /notifications 即重置为全部 */

"use client";

import { Suspense, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { NotificationList } from "@/components/notification/notification-list";

function NotificationsPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const type = searchParams.get("type") ?? undefined;

  const handleTypeChange = useCallback(
    (next: string | undefined) => {
      router.replace(next ? `/notifications?type=${encodeURIComponent(next)}` : "/notifications");
    },
    [router],
  );

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <h1 className="mb-5 text-xl font-bold text-foreground">通知</h1>
      <NotificationList type={type} onTypeChange={handleTypeChange} />
    </div>
  );
}

export default function NotificationsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[calc(100vh-3.5rem)] items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      }
    >
      <NotificationsPageInner />
    </Suspense>
  );
}
