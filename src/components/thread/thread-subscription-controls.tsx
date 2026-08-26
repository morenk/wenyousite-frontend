"use client";

import { useState } from "react";
import { Popover } from "@base-ui/react/popover";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { getApiErrorMessage } from "@/api/errors";
import { useSubscriptions } from "@/api/hooks/use-subscriptions";
import { useMembers } from "@/api/hooks/use-members";
import {
  useCreateSubscription,
  useDeleteSubscription,
} from "@/api/hooks/use-subscription-mutations";
import type { ThreadDetail } from "@/api/hooks/use-thread-detail";
import { Button } from "@/components/ui/button";
import { InteractionToggle } from "@/components/ui/interaction-toggle";
import { UserAvatar } from "@/components/shared/user-avatar";
import { useThreadPermissions } from "@/components/thread/thread-permissions-context";

const THREAD_SUBSCRIPTION_TARGET = "thread";

/** 主题详情中的统一更新订阅面板。 */
export function ThreadSubscriptionControls({ thread }: {
  thread: ThreadDetail;
}) {
  const { user } = useAuth();
  const { isManager, isOwner: roleIsOwner } = useThreadPermissions();
  const isOwner = roleIsOwner || user?.id === thread.ownerId;
  const hasAutomaticUpdates = isManager || isOwner;
  const { data: subscriptions, isLoading: subscriptionsLoading } = useSubscriptions(!!user);
  const [popoverOpen, setPopoverOpen] = useState(false);
  const {
    data: members = [],
    isLoading: membersLoading,
    isError: membersError,
    refetch: refetchMembers,
  } = useMembers(
    user && !hasAutomaticUpdates && popoverOpen ? thread.id : undefined,
  );
  const createSubscription = useCreateSubscription();
  const deleteSubscription = useDeleteSubscription();
  const [pendingTarget, setPendingTarget] = useState<string | null>(null);

  if (!user || hasAutomaticUpdates) return null;

  const currentSubscriptions = subscriptions?.filter(
    (subscription) => subscription.threadId === thread.id,
  ) ?? [];
  const threadSubscription = currentSubscriptions.find(
    (subscription) => subscription.type === "THREAD",
  );
  const candidateMembers = members.filter(
    (member) => member.role === "PARTICIPANT"
      && member.playerMarked
      && member.userId !== user.id,
  );
  const hasAnySubscription = currentSubscriptions.some(
    (subscription) => subscription.type === "THREAD" || subscription.type === "USER",
  );
  const isPending = createSubscription.isPending || deleteSubscription.isPending;

  const handleToggleThread = async () => {
    setPendingTarget(THREAD_SUBSCRIPTION_TARGET);
    try {
      if (threadSubscription) {
        await deleteSubscription.mutateAsync(threadSubscription.id);
      } else {
        await createSubscription.mutateAsync({ threadId: thread.id, type: "THREAD" });
      }
    } catch (error: unknown) {
      toast.error(getApiErrorMessage(error, "操作失败，请稍后重试"));
    } finally {
      setPendingTarget(null);
    }
  };

  const handleToggleUser = async (targetUserId: string) => {
    const userSubscription = currentSubscriptions.find(
      (subscription) => subscription.type === "USER"
        && subscription.targetUserId === targetUserId,
    );
    setPendingTarget(targetUserId);
    try {
      if (userSubscription) {
        await deleteSubscription.mutateAsync(userSubscription.id);
      } else {
        await createSubscription.mutateAsync({
          threadId: thread.id,
          type: "USER",
          targetUserId,
        });
      }
    } catch (error: unknown) {
      toast.error(getApiErrorMessage(error, "操作失败，请稍后重试"));
    } finally {
      setPendingTarget(null);
    }
  };

  return (
    <Popover.Root open={popoverOpen} onOpenChange={setPopoverOpen}>
      <Popover.Trigger
        render={
          <InteractionToggle
            tone="subscription"
            pressed={hasAnySubscription}
            icon="action.subscribe"
            accessibleName="管理更新订阅"
            accessibleDescription={hasAnySubscription ? "当前已有更新订阅" : "当前没有更新订阅"}
            actionTitle="管理更新订阅"
            size="icon-sm"
          />
        }
      />
      <Popover.Portal>
        <Popover.Positioner
          side="bottom"
          align="end"
          sideOffset={8}
          className="z-[var(--layer-popup)]"
        >
          <Popover.Popup className="w-[min(20rem,calc(100vw-2rem))] rounded-2xl border border-border bg-popover p-2 text-popover-foreground shadow-popover outline-none">
            <div className="px-2 pb-2 pt-1">
              <Popover.Title className="text-sm font-semibold">管理更新订阅</Popover.Title>
              <Popover.Description className="mt-1 text-xs leading-5 text-muted-foreground">
                选择你想在本帖收到的更新。
              </Popover.Description>
            </div>

            <div className="flex items-center justify-between gap-3 rounded-xl px-2 py-2.5 hover:bg-muted/60">
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground">官方更新</p>
                <p className="mt-0.5 text-xs leading-5 text-muted-foreground">
                  接收楼主与协作者的新发言
                </p>
              </div>
              <SubscriptionSwitch
                checked={Boolean(threadSubscription)}
                pending={isPending && pendingTarget === THREAD_SUBSCRIPTION_TARGET}
                disabled={subscriptionsLoading || isPending}
                label={threadSubscription ? "取消订阅官方更新" : "订阅官方更新"}
                onClick={() => void handleToggleThread()}
              />
            </div>

            <div className="mt-1 border-t border-border px-2 pb-1 pt-3">
              <p className="text-xs font-semibold text-foreground">玩家更新</p>
              <p className="mt-0.5 text-xs leading-5 text-muted-foreground">
                可同时订阅多名已标记玩家
              </p>
            </div>

            {membersLoading ? (
              <div className="flex items-center justify-center gap-2 px-2 py-6 text-xs text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                正在加载玩家…
              </div>
            ) : membersError ? (
              <div className="flex items-center justify-between gap-3 rounded-xl px-2 py-3">
                <p className="text-xs text-muted-foreground">玩家列表加载失败</p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => void refetchMembers()}
                  aria-label="重试加载玩家列表"
                >
                  重试
                </Button>
              </div>
            ) : candidateMembers.length === 0 ? (
              <p className="px-2 py-5 text-center text-xs text-muted-foreground">
                暂无可订阅的玩家
              </p>
            ) : (
              <div className="max-h-[min(18rem,45vh)] overflow-y-auto overscroll-contain">
                {candidateMembers.map((member) => {
                  const userSubscription = currentSubscriptions.find(
                    (subscription) => subscription.type === "USER"
                      && subscription.targetUserId === member.userId,
                  );
                  return (
                    <div
                      key={member.userId}
                      className="flex items-center justify-between gap-3 rounded-xl px-2 py-2 hover:bg-muted/60"
                    >
                      <div className="flex min-w-0 items-center gap-2.5">
                        <UserAvatar
                          name={member.user.username}
                          src={member.user.avatar}
                          className="h-8 w-8"
                          textClassName="text-xs"
                        />
                        <span className="truncate text-sm text-foreground">
                          {member.user.username}
                        </span>
                      </div>
                      <SubscriptionSwitch
                        checked={Boolean(userSubscription)}
                        pending={isPending && pendingTarget === member.userId}
                        disabled={subscriptionsLoading || isPending}
                        label={userSubscription
                          ? `取消订阅${member.user.username}的发言`
                          : `订阅${member.user.username}的发言`}
                        onClick={() => void handleToggleUser(member.userId)}
                      />
                    </div>
                  );
                })}
              </div>
            )}
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}

function SubscriptionSwitch({
  checked,
  pending,
  disabled,
  label,
  onClick,
}: {
  checked: boolean;
  pending: boolean;
  disabled: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <div className="flex shrink-0 items-center gap-2">
      {pending && <Loader2 aria-hidden="true" className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        aria-busy={pending || undefined}
        onClick={onClick}
        disabled={disabled}
        className={cn(
          "relative h-6 w-11 shrink-0 rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30 disabled:cursor-not-allowed disabled:opacity-50",
          checked ? "bg-brand-strong" : "bg-muted-foreground/30",
        )}
      >
        <span
          aria-hidden="true"
          className={cn(
            "pointer-events-none absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-card shadow transition-transform",
            checked ? "translate-x-5" : "translate-x-0",
          )}
        />
      </button>
    </div>
  );
}
