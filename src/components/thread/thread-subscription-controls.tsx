"use client";

import { useState } from "react";
import { Bell, BellOff, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { getApiErrorMessage } from "@/api/errors";
import { useSubscriptions } from "@/api/hooks/use-subscriptions";
import { useMembers } from "@/api/hooks/use-members";
import {
  useCreateSubscription,
  useDeleteSubscription,
} from "@/api/hooks/use-subscription-mutations";
import type { ThreadDetail } from "@/api/hooks/use-thread-detail";
import { Button } from "@/components/ui/button";
import { useThreadPermissions } from "@/components/thread/thread-permissions-context";

/** 主题详情中的官方更新与玩家发言订阅控制。 */
export function ThreadSubscriptionControls({ thread }: { thread: ThreadDetail }) {
  const { user } = useAuth();
  const { isManager, isOwner: roleIsOwner } = useThreadPermissions();
  const isOwner = roleIsOwner || user?.id === thread.ownerId;
  const hasAutomaticUpdates = isManager || isOwner;
  const { data: subscriptions } = useSubscriptions(!!user);
  const { data: members = [] } = useMembers(
    user && !hasAutomaticUpdates ? thread.id : undefined,
  );
  const createSubscription = useCreateSubscription();
  const deleteSubscription = useDeleteSubscription();
  const [selectedTargetUserId, setSelectedTargetUserId] = useState("");

  if (!user || hasAutomaticUpdates) return null;

  const threadSubscription = subscriptions?.find(
    (subscription) => subscription.threadId === thread.id && subscription.type === "THREAD",
  );
  const candidateMembers = members.filter(
    (member) => member.role === "PARTICIPANT"
      && member.playerMarked
      && member.userId !== user.id,
  );
  const selectedUserSubscription = subscriptions?.find(
    (subscription) => subscription.threadId === thread.id
      && subscription.type === "USER"
      && subscription.targetUserId === selectedTargetUserId,
  );
  const isPending = createSubscription.isPending || deleteSubscription.isPending;

  const handleToggleThread = async () => {
    try {
      if (threadSubscription) {
        await deleteSubscription.mutateAsync(threadSubscription.id);
        toast.success("已取消订阅");
      } else {
        await createSubscription.mutateAsync({ threadId: thread.id, type: "THREAD" });
        toast.success("已订阅，帖子更新将通知你");
      }
    } catch (error: unknown) {
      toast.error(getApiErrorMessage(error, "操作失败，请稍后重试"));
    }
  };

  const handleToggleUser = async () => {
    if (!selectedTargetUserId) return;
    try {
      if (selectedUserSubscription) {
        await deleteSubscription.mutateAsync(selectedUserSubscription.id);
        toast.success("已取消该用户的发言订阅");
      } else {
        await createSubscription.mutateAsync({
          threadId: thread.id,
          type: "USER",
          targetUserId: selectedTargetUserId,
        });
        toast.success("已订阅该用户在本帖的发言");
      }
    } catch (error: unknown) {
      toast.error(getApiErrorMessage(error, "操作失败，请稍后重试"));
    }
  };

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => void handleToggleThread()}
        disabled={isPending}
        title={threadSubscription ? "取消订阅" : "订阅官方更新"}
      >
        {isPending ? (
          <Loader2 className="mr-1 h-4 w-4 animate-spin" />
        ) : threadSubscription ? (
          <BellOff className="mr-1 h-4 w-4" />
        ) : (
          <Bell className="mr-1 h-4 w-4" />
        )}
        {threadSubscription ? "已订阅官方更新" : "订阅官方更新"}
      </Button>

      {candidateMembers.length > 0 && (
        <div className="flex items-center gap-1">
          <select
            aria-label="订阅帖内玩家"
            value={selectedTargetUserId}
            onChange={(event) => setSelectedTargetUserId(event.target.value)}
            className="h-8 max-w-32 rounded-md border border-border bg-background px-2 text-xs"
          >
            <option value="">选择玩家</option>
            {candidateMembers.map((member) => (
              <option key={member.userId} value={member.userId}>
                {member.user.username}
              </option>
            ))}
          </select>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => void handleToggleUser()}
            disabled={!selectedTargetUserId || isPending}
            aria-label={selectedUserSubscription ? "取消订阅该玩家" : "订阅该玩家"}
          >
            {selectedUserSubscription ? "取消玩家订阅" : "订阅玩家回复"}
          </Button>
        </div>
      )}
    </>
  );
}
