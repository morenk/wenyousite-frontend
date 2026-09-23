/** 拉黑/取消拉黑按钮：confirm 二次确认，拉黑后提示已屏蔽 */

"use client";

import { Loader2, Ban } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { getApiErrorMessage } from "@/api/errors";
import { useBlockActions } from "@/api/hooks/use-block-actions";
import { Button } from "@/components/ui/button";
import { useRelationshipActionScope } from "@/lib/use-relationship-action-scope";
import { useConfirm } from "@/components/ui/confirm-provider";

interface BlockButtonProps {
  userId: string;
  isBlocked: boolean;
}

export function BlockButton({ userId, isBlocked }: BlockButtonProps) {
  const { user } = useAuth();
  const { block, unblock, reconcile, isPending: sharedPending, needsReconciliation } = useBlockActions(userId);
  const confirmAction = useConfirm();
  const beginScope = useRelationshipActionScope(userId);

  if (!user) return null;

  const isPending = sharedPending || block.isPending || unblock.isPending;

  const handleBlock = async () => {
    if (isPending) return;
    const scope = beginScope();
    try {
      if (needsReconciliation) {
        await reconcile.mutateAsync();
        return;
      }
      const confirmed = await confirmAction({
        title: "拉黑用户",
        description: "确定要拉黑该用户吗？双方内容和私聊将互相隐藏，历史记录保留。",
        confirmLabel: "拉黑",
        destructive: true,
      });
      if (!confirmed || !scope.isCurrent()) return;
      await block.mutateAsync();
    } catch (error) {
      if (scope.isCurrent()) toast.error(getApiErrorMessage(error, "操作失败，请稍后重试"));
    } finally { scope.dispose(); }
  };

  const handleUnblock = async () => {
    if (isPending) return;
    const scope = beginScope();
    try { await unblock.mutateAsync(); }
    catch (error) { if (scope.isCurrent()) toast.error(getApiErrorMessage(error, "操作失败，请稍后重试")); }
    finally { scope.dispose(); }
  };

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={needsReconciliation || !isBlocked ? handleBlock : handleUnblock}
      disabled={isPending}
      className="text-destructive hover:text-destructive"
    >
      {isPending ? (
        <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
      ) : (
        <Ban className="mr-1.5 h-4 w-4" />
      )}
      {needsReconciliation ? "刷新核实" : isBlocked ? "已拉黑" : "拉黑"}
    </Button>
  );
}
