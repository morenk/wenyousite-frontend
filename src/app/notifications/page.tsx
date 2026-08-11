/** 通知列表页：URL ?type= 同步类型筛选，点击导航栏通知入口回到 /notifications 即重置为全部 */

"use client";

import { Suspense, useCallback } from "react";
import { useQueryState } from "nuqs";
import { Loader2 } from "lucide-react";
import { NotificationList } from "@/components/notification/notification-list";
import { MessageCenterTabs } from "@/components/message/message-center-tabs";
import { notificationTypeParser } from "@/lib/url-state";
import { PageHeader } from "@/components/layout/page-header";
import { PageShell } from "@/components/layout/page-shell";

function NotificationsPageInner() {
  const [type, setType] = useQueryState("type", notificationTypeParser.withOptions({
    history: "push",
    shallow: true,
  }));

  const handleTypeChange = useCallback(
    (next: string | undefined) => {
      void setType(next ? (next as NonNullable<typeof type>) : null);
    },
    [setType],
  );

  return (
    <PageShell width="feed">
      <PageHeader title="通知" />
      <MessageCenterTabs />
      <div className="mt-5">
        <NotificationList type={type ?? undefined} onTypeChange={handleTypeChange} />
      </div>
    </PageShell>
  );
}

export default function NotificationsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      }
    >
      <NotificationsPageInner />
    </Suspense>
  );
}
