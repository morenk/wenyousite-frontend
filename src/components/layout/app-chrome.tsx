"use client";

import { usePathname } from "next/navigation";

import { NavBar } from "@/components/layout/nav-bar";
import { AppContextRail } from "@/components/layout/app-context-rail";
import { cn } from "@/lib/utils";

export type AppChromeMode = "community" | "workspace" | "auth";

const authRoutes = [
  "/login",
  "/register",
  "/forgot-password",
  "/reset-password",
  "/verify-email",
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
    <div
      data-slot="app-chrome"
      data-mode={mode}
      className={cn(
        "mx-auto grid min-h-screen w-full items-start gap-4 px-3 sm:px-4",
        mode === "community"
          ? "max-w-[78rem] grid-cols-[4.5rem_minmax(0,1fr)] xl:grid-cols-[13rem_minmax(0,42rem)_17rem]"
          : "max-w-[78rem] grid-cols-[4.5rem_minmax(0,1fr)]",
      )}
    >
      <NavBar compact={mode === "workspace"} />
      <main className="min-w-0">{children}</main>
      {mode === "community" ? <AppContextRail /> : null}
    </div>
  );
}
