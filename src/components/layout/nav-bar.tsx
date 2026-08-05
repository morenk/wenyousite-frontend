/** 全局导航栏 */

"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { toast } from "sonner";

import { useAuth } from "@/lib/auth";
import { apiClient } from "@/api/client";
import { useUnreadCount } from "@/api/hooks/use-unread-count";
import { Button } from "@/components/ui/button";

export function NavBar() {
  const router = useRouter();
  const { user, logout } = useAuth();
  const { data: unreadCount } = useUnreadCount(user?.id);

  const handleLogout = async () => {
    try {
      const { error } = await apiClient.POST("/api/v1/auth/logout", { body: {} });
      if (error) throw error;
    } catch {
      toast.error("退出失败，请检查网络后重试");
      return;
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
          <Link
            href="/search"
            title="搜索"
            className="text-muted-foreground hover:text-foreground"
          >
            <Search className="h-4.5 w-4.5" />
          </Link>
          {user ? (
            <>
              <Link
                href="/notifications"
                className="relative text-sm text-muted-foreground hover:text-foreground"
              >
                通知
                {!!unreadCount && unreadCount > 0 && (
                  <span className="absolute -right-3 -top-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold text-white">
                    {unreadCount > 99 ? "99+" : unreadCount}
                  </span>
                )}
              </Link>
              <Link
                href={`/users/${user.id}`}
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
