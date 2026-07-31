/** 全局导航栏 */

"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { useAuth } from "@/lib/auth";
import { apiClient } from "@/api/client";
import { Button } from "@/components/ui/button";

export function NavBar() {
  const router = useRouter();
  const { user, logout } = useAuth();

  const handleLogout = async () => {
    try {
      await apiClient.POST("/api/v1/auth/logout", { body: {} });
    } catch {
      // 登出接口失败也不阻断前端清除
    }
    logout();
    toast.success("已登出");
    router.replace("/");
    router.refresh();
  };

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur-sm">
      <nav className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
        <Link href="/" className="flex items-center gap-2">
          <span className="text-lg font-bold text-primary">温油站</span>
        </Link>

        <div className="flex items-center gap-2">
          {user ? (
            <>
              <Link
                href="/notifications"
                className="text-sm text-muted-foreground hover:text-foreground"
              >
                通知
              </Link>
              <Link
                href="/drafts"
                className="text-sm text-muted-foreground hover:text-foreground"
              >
                草稿箱
              </Link>
              <Link
                href="/me"
                className="text-sm font-medium text-foreground hover:text-primary"
              >
                {user.username}
              </Link>
              <Button variant="ghost" size="sm" onClick={handleLogout}>
                退出
              </Button>
            </>
          ) : (
            <>
              <Link href="/login">
                <Button variant="ghost" size="sm">
                  登录
                </Button>
              </Link>
              <Link href="/register">
                <Button size="sm">注册</Button>
              </Link>
            </>
          )}
        </div>
      </nav>
    </header>
  );
}
