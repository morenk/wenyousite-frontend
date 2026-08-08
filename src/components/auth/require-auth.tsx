/** 客户端认证边界：集中处理受保护路由的初始化、登录和邮箱验证跳转。 */

"use client";

import { useEffect, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/lib/auth";

export function RequireAuth({
  children,
  requireVerifiedEmail = false,
}: {
  children: ReactNode;
  requireVerifiedEmail?: boolean;
}) {
  const { user, isInitialized } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (!isInitialized) return;
    if (!user) {
      router.replace(`/login?next=${encodeURIComponent(pathname)}`);
      return;
    }
    if (requireVerifiedEmail && !user.emailVerified) {
      router.replace("/verify-email");
    }
  }, [isInitialized, pathname, requireVerifiedEmail, router, user]);

  if (!isInitialized || !user || (requireVerifiedEmail && !user.emailVerified)) {
    return (
      <div
        className="flex min-h-screen items-center justify-center"
        role="status"
        aria-label="正在验证登录状态"
      >
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return children;
}
