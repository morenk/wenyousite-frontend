"use client";

import { usePathname } from "next/navigation";
import { MessageCenterTabs } from "@/components/message/message-center-tabs";
import { DirectConversationList } from "@/components/message/direct-conversation-list";

export function DirectMessagesFrame({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const selectedId = pathname.match(/^\/messages\/([^/]+)$/)?.[1];

  return (
    <div className="mx-auto flex h-screen min-h-0 w-full max-w-6xl flex-col overflow-hidden px-2 py-4 sm:px-4">
      <h1 className="mb-3 font-display text-[1.75rem] font-bold text-foreground">私聊</h1>
      <MessageCenterTabs />
      <div className="mt-4 grid min-h-0 flex-1 grid-cols-[19rem_minmax(0,1fr)] overflow-hidden rounded-2xl border border-border bg-card">
        <DirectConversationList selectedId={selectedId} />
        {children}
      </div>
    </div>
  );
}
