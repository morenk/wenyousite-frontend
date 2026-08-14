"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAVIGATION_LABELS } from "@wenyousite/foundation/navigation";
import { useUnreadCounts } from "@/components/layout/unread-counts-context";
import { cn } from "@/lib/utils";

function CountBadge({ count }: { count: number }) {
  if (count < 1) return null;
  return (
    <span className="rounded-full bg-destructive px-1.5 py-0.5 font-utility text-[10px] font-bold leading-none text-destructive-foreground">
      {count > 99 ? "99+" : count}
    </span>
  );
}

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
          <CountBadge count={tab.count} />
        </Link>
      ))}
    </div>
  );
}
