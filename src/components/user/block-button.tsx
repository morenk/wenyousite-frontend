/** 拉黑/取消拉黑按钮：confirm 二次确认，拉黑后提示已屏蔽 */

"use client";

import { Loader2, Ban } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { useBlockActions } from "@/api/hooks/use-block-actions";
import { Button } from "@/components/ui/button";
import { useConfirm } from "@/components/ui/confirm-provider";

interface BlockButtonProps {
  userId: string;
  isBlocked: boolean;
}

export function BlockButton({ userId, isBlocked }: BlockButtonProps) {
  const { user } = useAuth();
  const { block, unblock } = useBlockActions(userId);
  const confirmAction = useConfirm();

  if (!user) return null;

  const isPending = block.isPending || unblock.isPending;

  const handleBlock = async () => {
    if (!(await confirmAction({
      title: "拉黑用户",
      description: "确定要拉黑该用户吗？拉黑后将屏蔽其回复与通知。",
      confirmLabel: "拉黑",
      destructive: true,
    }))) return;
    try {
      await block.mutateAsync();
      toast.success("已拉黑");
    } catch {
      toast.error("操作失败，请稍后重试");
    }
  };

  const handleUnblock = async () => {
    try {
      await unblock.mutateAsync();
      toast.success("已取消拉黑");
    } catch {
      toast.error("操作失败，请稍后重试");
    }
  };

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={isBlocked ? handleUnblock : handleBlock}
      disabled={isPending}
      className="text-destructive hover:text-destructive"
    >
      {isPending ? (
        <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
      ) : (
        <Ban className="mr-1.5 h-4 w-4" />
      )}
      {isBlocked ? "已拉黑" : "拉黑"}
    </Button>
  );
}
