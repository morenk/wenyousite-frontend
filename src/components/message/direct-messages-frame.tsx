"use client";

import { usePathname } from "next/navigation";
import { MessageCenterTabs } from "@/components/message/message-center-tabs";
import { DirectConversationList } from "@/components/message/direct-conversation-list";

export function DirectMessagesFrame({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const selectedId = pathname.match(/^\/messages\/([^/]+)$/)?.[1];

  return (
    <div className="mx-auto flex h-screen min-h-0 w-full max-w-workspace flex-col overflow-hidden py-8">
      <h1 className="mb-3 font-sans text-[length:var(--type-page-title-size)] font-semibold leading-[var(--type-page-title-line-height)] text-foreground">私聊</h1>
      <MessageCenterTabs />
      <div className="mt-4 grid min-h-0 flex-1 grid-cols-[clamp(5rem,24%,11rem)_minmax(0,1fr)] overflow-hidden rounded-[var(--radius-panel)] border border-border bg-card">
        <DirectConversationList selectedId={selectedId} />
        {children}
      </div>
    </div>
  );
}
