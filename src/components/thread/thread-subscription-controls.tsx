"use client";

import { useState } from "react";
import { Popover } from "@base-ui/react/popover";
import { Bell, BellOff, Loader2, UsersRound } from "lucide-react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useThreadPermissions } from "@/components/thread/thread-permissions-context";

/** 主题详情中的官方更新与玩家发言订阅控制。 */
export function ThreadSubscriptionControls({ thread }: {
  thread: ThreadDetail;
}) {
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
  const [selectedTargetUserId, setSelectedTargetUserId] = useState<string | null>(null);
  const [playerPopoverOpen, setPlayerPopoverOpen] = useState(false);

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
      setPlayerPopoverOpen(false);
    } catch (error: unknown) {
      toast.error(getApiErrorMessage(error, "操作失败，请稍后重试"));
    }
  };

  return (
    <>
      <Button
        variant="ghost"
        size="icon-sm"
        onClick={() => void handleToggleThread()}
        disabled={isPending}
        aria-label={threadSubscription ? "取消订阅官方更新" : "订阅官方更新"}
        title={threadSubscription ? "取消订阅官方更新" : "订阅官方更新"}
        className={threadSubscription ? "bg-accent text-brand-strong hover:text-brand-strong" : undefined}
      >
        {isPending ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : threadSubscription ? (
          <BellOff className="h-4 w-4" />
        ) : (
          <Bell className="h-4 w-4" />
        )}
      </Button>

      {candidateMembers.length > 0 && (
        <Popover.Root open={playerPopoverOpen} onOpenChange={setPlayerPopoverOpen}>
          <Popover.Trigger
            render={
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="订阅玩家发言"
                title="订阅玩家发言"
              />
            }
          >
            <UsersRound className="h-4 w-4" />
          </Popover.Trigger>
          <Popover.Portal>
            <Popover.Positioner side="bottom" align="end" sideOffset={8} className="z-[var(--layer-popup)]">
              <Popover.Popup className="w-64 rounded-xl border border-border bg-popover p-3 text-popover-foreground shadow-popover outline-none">
                <Popover.Title className="text-sm font-semibold">订阅玩家发言</Popover.Title>
                <Popover.Description className="mt-1 text-xs leading-5 text-muted-foreground">
                  选择一名玩家，订阅其在本帖中的新发言。
                </Popover.Description>
                <div className="mt-3 space-y-2">
                  <Select
                    items={candidateMembers.map((member) => ({
                      value: member.userId,
                      label: member.user.username,
                    }))}
                    value={selectedTargetUserId}
                    onValueChange={setSelectedTargetUserId}
                  >
                    <SelectTrigger size="compact" aria-label="订阅帖内玩家" className="w-full">
                      <SelectValue placeholder="选择玩家" />
                    </SelectTrigger>
                    <SelectContent align="start">
                      {candidateMembers.map((member) => (
                        <SelectItem key={member.userId} value={member.userId}>
                        {member.user.username}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    variant="default"
                    size="sm"
                    className="w-full"
                    onClick={() => void handleToggleUser()}
                    disabled={!selectedTargetUserId || isPending}
                    aria-label={selectedUserSubscription ? "取消订阅该玩家" : "订阅该玩家"}
                  >
                    {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                    {selectedUserSubscription ? "取消订阅" : "订阅发言"}
                  </Button>
                </div>
              </Popover.Popup>
            </Popover.Positioner>
          </Popover.Portal>
        </Popover.Root>
      )}
    </>
  );
}
