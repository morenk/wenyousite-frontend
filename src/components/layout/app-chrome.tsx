"use client";

import { usePathname } from "next/navigation";

import { NavBar } from "@/components/layout/nav-bar";
import { AppContextRail } from "@/components/layout/app-context-rail";
import { useDirectUnreadCount } from "@/api/hooks/use-direct-conversations";
import { useUnreadCount } from "@/api/hooks/use-unread-count";
import { UnreadCountsProvider } from "@/components/layout/unread-counts-context";
import { useAuth } from "@/lib/auth";
import { isToolEmbedPath } from "@/lib/tools/catalog";
import { ThemeMenu } from "@/components/layout/theme-menu";

export type AppChromeMode = "community" | "workspace" | "auth" | "embed";

const authRoutes = [
  "/login",
  "/register",
  "/forgot-password",
  "/reset-password",
  "/station",
];

export function getAppChromeMode(pathname: string): AppChromeMode {
  if (isToolEmbedPath(pathname)) return "embed";
  if (authRoutes.some((route) => pathname === route || pathname.startsWith(`${route}/`))) {
    return "auth";
  }
  if (
    pathname === "/tools" || pathname.startsWith("/tools/") ||
    pathname === "/bookmarks" ||
    /^\/me(?:\/(?:appearance|privacy|security|password|email))?$/.test(pathname) ||
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

  if (mode === "embed") return <main className="min-h-screen min-w-0 bg-background">{children}</main>;

  if (mode === "auth") {
    return (
      <div data-slot="app-chrome" data-mode={mode} className="relative min-h-screen bg-background">
        <div className="fixed right-4 top-4 z-[var(--layer-chrome)] w-10">
          <ThemeMenu compact side="bottom" align="end" />
        </div>
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
  mode: Exclude<AppChromeMode, "auth" | "embed">;
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
      <div data-slot="site-surface" className="min-h-screen bg-muted/40">
      <div
      data-slot="app-chrome"
      data-mode={mode}
      className="mx-auto grid min-h-screen w-full max-w-chrome-workspace grid-cols-[3rem_minmax(0,1fr)_3rem] items-start gap-1 px-2 sm:grid-cols-[4.5rem_minmax(0,1fr)_4rem] sm:gap-2 sm:px-3 lg:grid-cols-[4.5rem_minmax(0,1fr)_14rem] xl:grid-cols-[4.5rem_minmax(0,1fr)_17rem]"
    >
      <NavBar compact />
      <main className="min-w-0">{children}</main>
      <AppContextRail />
      </div>
      </div>
    </UnreadCountsProvider>
  );
}
