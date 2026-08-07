"use client";

import { useEffect, type ReactNode } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { LoadingState } from "@/components/shared/loading-state";

function safeNextPath(value: string | null) {
  return value?.startsWith("/") && !value.startsWith("//") ? value : "/";
}

/** 访客路由边界：等待会话恢复，已登录用户离开登录/注册/找回密码页面。 */
export function GuestOnly({ children }: { children: ReactNode }) {
  const { user, isInitialized } = useAuth();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const authenticatedDestination = pathname === "/login"
    ? safeNextPath(searchParams.get("next"))
    : "/";

  useEffect(() => {
    if (isInitialized && user) router.replace(authenticatedDestination);
  }, [authenticatedDestination, isInitialized, router, user]);

  if (!isInitialized || user) {
    return <LoadingState variant="page" label="" />;
  }
  return children;
}
