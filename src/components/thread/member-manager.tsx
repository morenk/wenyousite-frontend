/** 成员管理组件：参与人候选池 + 授予/收回玩家标记 + 授予/移除协作者身份 */

"use client";

import { Loader2, ShieldCheck, Shield } from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useMembers } from "@/api/hooks/use-members";
import { useUpdateMember } from "@/api/hooks/use-update-member";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/shared/empty-state";
import { cn } from "@/lib/utils";
import type { ThreadMember } from "@/api/hooks/use-members";

interface MemberManagerProps {
  threadId: string;
  /** 楼主可任免协作者；楼主和协作者都可修改玩家标记。 */
  isOwner: boolean;
  isCollaborator: boolean;
  onRefetch: () => Promise<unknown>;
}

const ROLE_LABEL: Record<string, string> = {
  OWNER: "楼主",
  COLLABORATOR: "协作者",
  PARTICIPANT: "参与人",
};

export function MemberManager({ threadId, isOwner, isCollaborator, onRefetch }: MemberManagerProps) {
  const queryClient = useQueryClient();
  const { data: members, isLoading, error, refetch } = useMembers(threadId);
  const updateMember = useUpdateMember();

  const invalidate = async () => {
    await queryClient.invalidateQueries({ queryKey: ["members", threadId] });
    await onRefetch();
  };

  const handleTogglePlayer = async (m: ThreadMember) => {
    try {
      await updateMember.mutateAsync({
        threadId,
        userId: m.userId,
        playerMarked: !m.playerMarked,
      });
      toast.success(m.playerMarked ? "已收回玩家身份" : "已授予玩家身份");
      await invalidate();
    } catch (error: unknown) {
      const err = error as { message?: string };
      toast.error(err.message || "操作失败，请稍后重试");
    }
  };

  const handleToggleCollaborator = async (m: ThreadMember) => {
    const nextRole = m.role === "COLLABORATOR" ? "PARTICIPANT" : "COLLABORATOR";
    try {
      await updateMember.mutateAsync({ threadId, userId: m.userId, role: nextRole });
      toast.success(nextRole === "COLLABORATOR" ? "已升级为协作者" : "已降级为参与人");
      await invalidate();
    } catch (error: unknown) {
      const err = error as { message?: string };
      toast.error(err.message || "操作失败，请稍后重试");
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center gap-4 py-16">
        <EmptyState title="加载失败" description="请检查网络连接后重试" />
        <Button variant="outline" size="sm" onClick={() => refetch()}>
          重试
        </Button>
      </div>
    );
  }

  if (!members || members.length === 0) {
    return (
      <div className="py-16">
        <EmptyState title="暂无参与人" description="回复帖子后自动加入候选池" />
      </div>
    );
  }

  return (
    <div className="space-y-2 p-4">
      <p className="text-xs text-muted-foreground">
        {members.length} 位参与人（回复后自动加入候选池）
      </p>
      <ul className="divide-y divide-border rounded-lg border border-border bg-background">
        {members.map((m) => (
          <li key={m.id} className="flex items-center justify-between gap-3 px-4 py-3">
            <div className="flex min-w-0 items-center gap-3">
              <Link
                href={`/users/${m.userId}`}
                className="truncate text-sm font-medium text-foreground hover:text-primary"
              >
                {m.user.username}
              </Link>
              <span
                className={cn(
                  "rounded-full px-2 py-0.5 text-xs",
                  m.role === "OWNER"
                    ? "bg-primary/10 text-primary"
                    : m.role === "COLLABORATOR"
                      ? "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400"
                      : "bg-muted text-muted-foreground",
                )}
              >
                {ROLE_LABEL[m.role] ?? m.role}
              </span>
              {m.playerMarked && (
                <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-700 dark:bg-green-900/30 dark:text-green-400">
                  玩家
                </span>
              )}
            </div>

            {(isOwner || isCollaborator) && m.role !== "OWNER" && (
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs"
                  onClick={() => handleTogglePlayer(m)}
                  disabled={updateMember.isPending}
                  title={m.playerMarked ? "收回玩家身份" : "授予玩家身份"}
                >
                  {m.playerMarked ? "收回玩家" : "授予玩家"}
                </Button>
                {isOwner && <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs"
                  onClick={() => handleToggleCollaborator(m)}
                  disabled={updateMember.isPending}
                  title={m.role === "COLLABORATOR" ? "移除协作者身份" : "授予协作者身份"}
                >
                  {m.role === "COLLABORATOR" ? (
                    <Shield className="mr-1 h-3.5 w-3.5" />
                  ) : (
                    <ShieldCheck className="mr-1 h-3.5 w-3.5" />
                  )}
                  {m.role === "COLLABORATOR" ? "移除协作者" : "授予协作者"}
                </Button>}
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
