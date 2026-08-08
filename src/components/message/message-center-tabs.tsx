"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { useUnreadCount } from "@/api/hooks/use-unread-count";
import { useDirectUnreadCount } from "@/api/hooks/use-direct-conversations";
import { cn } from "@/lib/utils";

function CountBadge({ count }: { count: number }) {
  if (count < 1) return null;
  return (
    <span className="rounded-full bg-destructive px-1.5 py-0.5 font-utility text-[10px] font-bold leading-none text-white">
      {count > 99 ? "99+" : count}
    </span>
  );
}

export function MessageCenterTabs() {
  const pathname = usePathname();
  const { user } = useAuth();
  const { data: notificationCount = 0 } = useUnreadCount(user?.id);
  const { data: directUnread } = useDirectUnreadCount(user?.id);
  const tabs = [
    {
      href: "/notifications",
      label: "通知",
      active: pathname.startsWith("/notifications"),
      count: notificationCount,
    },
    {
      href: "/messages",
      label: "私聊",
      active: pathname.startsWith("/messages"),
      count: directUnread?.total ?? 0,
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
