/** 客户端认证边界：集中处理受保护路由的初始化和登录跳转。 */

"use client";

import { useEffect, type ReactNode } from "react";
import { useAuth } from "@/lib/auth";
import { LoadingState } from "@/components/shared/loading-state";
import { useLoginRedirect } from "@/hooks/use-login-redirect";

export function RequireAuth({
  children,
}: {
  children: ReactNode;
}) {
  const { user, isInitialized } = useAuth();
  const redirectToLogin = useLoginRedirect();

  useEffect(() => {
    if (!isInitialized) return;
    if (!user) {
      redirectToLogin({ replace: true });
      return;
    }
  }, [isInitialized, redirectToLogin, user]);

  if (!isInitialized || !user) {
    return <LoadingState variant="page" label="正在验证登录状态" />;
  }

  return children;
}
