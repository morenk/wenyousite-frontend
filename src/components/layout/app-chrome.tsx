"use client";

import { usePathname } from "next/navigation";

import { NavBar } from "@/components/layout/nav-bar";
import { AppContextRail } from "@/components/layout/app-context-rail";
import { useDirectUnreadCount } from "@/api/hooks/use-direct-conversations";
import { useUnreadCount } from "@/api/hooks/use-unread-count";
import { UnreadCountsProvider } from "@/components/layout/unread-counts-context";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";

export type AppChromeMode = "community" | "workspace" | "auth";

const authRoutes = [
  "/login",
  "/register",
  "/forgot-password",
  "/reset-password",
  "/station",
];

export function getAppChromeMode(pathname: string): AppChromeMode {
  if (authRoutes.some((route) => pathname === route || pathname.startsWith(`${route}/`))) {
    return "auth";
  }
  if (
    pathname === "/threads/create" ||
    /^\/threads\/[^/]+\/edit(?:\/|$)/.test(pathname) ||
    pathname === "/messages" ||
    pathname.startsWith("/messages/")
  ) {
    return "workspace";
  }
  return "community";
}

export function AppChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const mode = getAppChromeMode(pathname);

  if (mode === "auth") {
    return (
      <div data-slot="app-chrome" data-mode={mode} className="min-h-screen bg-background">
        <main className="min-h-screen">{children}</main>
      </div>
    );
  }

  return (
    <AppChromeFrame mode={mode}>
      {children}
    </AppChromeFrame>
  );
}

function AppChromeFrame({
  mode,
  children,
}: {
  mode: Exclude<AppChromeMode, "auth">;
  children: React.ReactNode;
}) {
  const { user } = useAuth();
  const { data: unreadCount } = useUnreadCount(user?.id);
  const { data: directUnread } = useDirectUnreadCount(user?.id);

  return (
    <UnreadCountsProvider
      notificationCount={unreadCount ?? 0}
      directMessageCount={directUnread?.total ?? 0}
    >
      <div
      data-slot="app-chrome"
      data-mode={mode}
      className={cn(
        "mx-auto grid min-h-screen w-full items-start gap-4 px-3 sm:px-4",
        mode === "community"
          ? "max-w-[49.5rem] grid-cols-[4.5rem_minmax(0,42rem)] xl:max-w-wide xl:grid-cols-[17rem_minmax(0,42rem)_17rem]"
          : "max-w-chrome-workspace grid-cols-[4.5rem_minmax(0,1fr)]",
      )}
    >
      <NavBar compact={mode === "workspace"} />
      <main className="min-w-0">{children}</main>
      {mode === "community" ? <AppContextRail /> : null}
      </div>
    </UnreadCountsProvider>
  );
}
