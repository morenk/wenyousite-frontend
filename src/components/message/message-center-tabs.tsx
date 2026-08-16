"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAVIGATION_LABELS } from "@wenyousite/foundation/navigation";
import { useUnreadCounts } from "@/components/layout/unread-counts-context";
import { UnreadCountBadge } from "@/components/ui/unread-count-badge";
import { cn } from "@/lib/utils";

export function MessageCenterTabs() {
  const pathname = usePathname();
  const { notificationCount, directMessageCount } = useUnreadCounts();
  const tabs = [
    {
      href: "/notifications",
      label: NAVIGATION_LABELS.notifications,
      active: pathname.startsWith("/notifications"),
      count: notificationCount,
    },
    {
      href: "/messages",
      label: NAVIGATION_LABELS.directMessages,
      active: pathname.startsWith("/messages"),
      count: directMessageCount,
    },
  ];

  return (
    <div className="flex gap-1 border-b border-border" aria-label="消息中心分类">
      {tabs.map((tab) => (
        <Link
          key={tab.href}
          href={tab.href}
          className={cn(
            "flex h-10 items-center gap-1.5 border-b-[3px] px-4 text-sm font-semibold transition-colors",
            tab.active
              ? "border-brand-strong text-foreground"
              : "border-transparent text-muted-foreground hover:text-foreground",
          )}
        >
          {tab.label}
          <UnreadCountBadge count={tab.count} />
        </Link>
      ))}
    </div>
  );
}
