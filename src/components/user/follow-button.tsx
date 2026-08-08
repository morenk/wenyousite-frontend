/** 关注/取消关注按钮：仅登录显示，点击后即时切换 */

"use client";

import { Loader2, UserPlus, UserCheck } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { useFollowActions } from "@/api/hooks/use-follow-actions";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface FollowButtonProps {
  userId: string;
  isFollowing: boolean;
}

export function FollowButton({ userId, isFollowing }: FollowButtonProps) {
  const { user } = useAuth();
  const { follow, unfollow } = useFollowActions(userId);

  if (!user) return null;

  const isPending = follow.isPending || unfollow.isPending;

  const handleClick = async () => {
    if (isFollowing) {
      try {
        await unfollow.mutateAsync();
        toast.success("已取消关注");
      } catch {
        toast.error("操作失败，请稍后重试");
      }
    } else {
      try {
        await follow.mutateAsync();
        toast.success("关注成功");
      } catch {
        toast.error("操作失败，请稍后重试");
      }
    }
  };

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={handleClick}
      disabled={isPending}
      className={cn(
        "min-w-20",
        isFollowing && "text-brand-strong hover:text-brand-strong",
      )}
    >
      {isPending ? (
        <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
      ) : isFollowing ? (
        <UserCheck className="mr-1.5 h-4 w-4" />
      ) : (
        <UserPlus className="mr-1.5 h-4 w-4" />
      )}
      {isFollowing ? "已关注" : "关注"}
    </Button>
  );
}
