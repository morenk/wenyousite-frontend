/** 全局导航栏 */

"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Search, Wallet } from "lucide-react";
import { toast } from "sonner";

import { useAuth } from "@/lib/auth";
import { useLogout } from "@/api/hooks/use-auth-actions";
import { useUnreadCount } from "@/api/hooks/use-unread-count";
import { useDirectUnreadCount } from "@/api/hooks/use-direct-conversations";
import { Button } from "@/components/ui/button";
import { useWallet } from "@/api/hooks/use-economy";
import { formatWenyou } from "@/lib/wenyou";

export function NavBar() {
  const router = useRouter();
  const { user, logout } = useAuth();
  const logoutRequest = useLogout();
  const { data: unreadCount } = useUnreadCount(user?.id);
  const { data: directUnread } = useDirectUnreadCount(user?.id);
  const { data: wallet } = useWallet(user?.id);
  const totalUnread = (unreadCount ?? 0) + (directUnread?.total ?? 0);

  const handleLogout = async () => {
    try {
      await logoutRequest.mutateAsync();
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
                href="/wallet"
                title="我的温油"
                className="flex items-center gap-1 text-sm font-medium tabular-nums text-primary hover:text-primary/80"
              >
                <Wallet className="h-4 w-4" />
                {wallet ? formatWenyou(wallet.balance) : "—"} 升
              </Link>
              <Link
                href="/notifications"
                className="relative text-sm text-muted-foreground hover:text-foreground"
              >
                消息
                {totalUnread > 0 && (
                  <span className="absolute -right-3 -top-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold text-white">
                    {totalUnread > 99 ? "99+" : totalUnread}
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
