/** 账号安全面板：管理双端登录终端、黑名单和账号注销 */

"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { zhCN } from "date-fns/locale";
import { Loader2, Monitor, RefreshCw, Smartphone } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { getLoginTerminalLabel } from "@/lib/session-display";
import {
  useAccountSessions,
  useBlockedUsers,
  useDeleteAccount,
  useRevokeSession,
  useUnblockUser,
} from "@/api/hooks/use-account-security";
import { UserAvatar } from "@/components/shared/user-avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

function formatTime(value: string) {
  return format(new Date(value), "yyyy-MM-dd HH:mm", { locale: zhCN });
}

function getSessionErrorMessage(error: unknown) {
  const code = (error as { code?: number } | null)?.code;
  return code === 42900 ? "操作太频繁，请稍后再试" : "登录终端加载失败";
}

export function AccountSecurityPanel() {
  const router = useRouter();
  const { logout, user } = useAuth();
  const sessions = useAccountSessions(user?.id);
  const blockedUsers = useBlockedUsers(user?.id);
  const revokeSession = useRevokeSession(user?.id);
  const unblockUser = useUnblockUser(user?.id);
  const deleteAccount = useDeleteAccount();
  const [confirmation, setConfirmation] = useState("");

  async function handleRevoke(sessionId: string) {
    try {
      await revokeSession.mutateAsync(sessionId);
      toast.success("登录终端已退出");
    } catch (error: unknown) {
      toast.error((error as { message?: string }).message || "退出失败，请稍后重试");
    }
  }

  async function handleUnblock(userId: string) {
    try {
      await unblockUser.mutateAsync(userId);
      toast.success("已取消拉黑");
    } catch (error: unknown) {
      toast.error((error as { message?: string }).message || "操作失败，请稍后重试");
    }
  }

  async function handleDeleteAccount() {
    if (confirmation !== "注销账号") return;
    if (!window.confirm("账号注销后无法恢复，确定继续吗？")) return;
    try {
      await deleteAccount.mutateAsync();
      logout();
      toast.success("账号已注销");
      router.replace("/");
      router.refresh();
    } catch (error: unknown) {
      toast.error((error as { message?: string }).message || "注销失败，请稍后重试");
    }
  }

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader><CardTitle>登录终端</CardTitle></CardHeader>
        <CardContent>
          {sessions.isLoading ? (
            <Loader2 className="mx-auto h-5 w-5 animate-spin text-muted-foreground" />
          ) : sessions.error ? (
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm text-destructive">{getSessionErrorMessage(sessions.error)}</p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => void sessions.refetch()}
              >
                <RefreshCw className="mr-1 h-4 w-4" />
                重新加载
              </Button>
            </div>
          ) : sessions.data?.length ? (
            <ul className="divide-y divide-border">
              {sessions.data.map((session) => (
                <li key={session.id} className="flex items-center justify-between gap-4 py-3">
                  <div className="flex min-w-0 items-start gap-3">
                    {session.platform === "mobile" ? (
                      <Smartphone aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />
                    ) : (
                      <Monitor aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />
                    )}
                    <div>
                      <p className="text-sm font-medium">
                        {getLoginTerminalLabel(session.platform)}
                        {session.isCurrent && <span className="ml-2 text-xs text-primary">当前终端</span>}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        登录于 {formatTime(session.signedInAt ?? session.createdAt)} · 最近活动 {formatTime(session.lastActiveAt ?? session.createdAt)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        有效期至 {formatTime(session.expiresAt)}
                      </p>
                    </div>
                  </div>
                  {!session.isCurrent && (
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={revokeSession.isPending}
                      onClick={() => handleRevoke(session.id)}
                    >
                      退出登录
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">暂无活跃登录终端</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>黑名单</CardTitle></CardHeader>
        <CardContent>
          {blockedUsers.isLoading ? (
            <Loader2 className="mx-auto h-5 w-5 animate-spin text-muted-foreground" />
          ) : blockedUsers.error ? (
            <p className="text-sm text-destructive">黑名单加载失败</p>
          ) : blockedUsers.data?.length ? (
            <ul className="divide-y divide-border">
              {blockedUsers.data.map(({ id, blocked }) => (
                <li key={id} className="flex items-center justify-between gap-4 py-3">
                  <Link href={`/users/${blocked.id}`} className="flex items-center gap-3 hover:text-primary">
                    <UserAvatar name={blocked.username} src={blocked.avatar} className="h-8 w-8" />
                    <span className="text-sm font-medium">{blocked.username}</span>
                  </Link>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={unblockUser.isPending}
                    onClick={() => handleUnblock(blocked.id)}
                  >
                    取消拉黑
                  </Button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">黑名单为空</p>
          )}
        </CardContent>
      </Card>

      <Card className="border-destructive/40">
        <CardHeader><CardTitle className="text-destructive">注销账号</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            注销后账号、登录终端和身份信息将无法恢复。请输入“注销账号”确认。
          </p>
          <div className="flex max-w-md gap-2">
            <Input
              aria-label="注销确认文字"
              value={confirmation}
              onChange={(event) => setConfirmation(event.target.value)}
              placeholder="注销账号"
            />
            <Button
              variant="destructive"
              disabled={confirmation !== "注销账号" || deleteAccount.isPending}
              onClick={handleDeleteAccount}
            >
              {deleteAccount.isPending && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
              永久注销
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
