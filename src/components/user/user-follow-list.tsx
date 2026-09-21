"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useUserFollowList, type FollowListKind, type FollowUser } from "@/api/hooks/use-user-follow-list";
import { useFollowActions } from "@/api/hooks/use-follow-actions";
import { useViewerScope } from "@/api/use-viewer-scope";
import { UserAvatar } from "@/components/shared/user-avatar";
import { EmptyState } from "@/components/shared/empty-state";
import { LoadError } from "@/components/shared/load-error";
import { LoadingState } from "@/components/shared/loading-state";
import { LevelBadge } from "@/components/shared/level-badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogBackdrop, DialogDescription, DialogFooter, DialogPopup, DialogPortal, DialogTitle, DialogViewport } from "@/components/ui/dialog";
import { getApiErrorMessage } from "@/api/errors";

function FollowRow({ user, kind, isOwner, onRemoveIntent }: {
  user: FollowUser;
  kind: FollowListKind;
  isOwner: boolean;
  onRemoveIntent: () => void;
}) {
  const { follow, unfollow, removeFollower, reconcile, isPending, needsReconciliation } = useFollowActions(user.id);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string>();
  const [submitting, setSubmitting] = useState(false);
  const locked = useRef(false);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const pending = submitting || isPending;
  const known = typeof user.viewerIsFollowing === "boolean" && typeof user.viewerIsFollowedBy === "boolean";
  const mutual = user.viewerIsFollowing && user.viewerIsFollowedBy;

  async function act(action: "follow" | "unfollow" | "removeFollower" | "reconcile") {
    if (locked.current) return;
    locked.current = true;
    setSubmitting(true);
    setError(undefined);
    if (action === "removeFollower" || (action === "unfollow" && kind === "following")) onRemoveIntent();
    try {
      await ({ follow, unfollow, removeFollower, reconcile })[action].mutateAsync();
      setConfirming(false);
    } catch (error) {
      setError(getApiErrorMessage(error, "操作失败，请稍后重试"));
    } finally {
      locked.current = false;
      setSubmitting(false);
    }
  }

  return <li className="flex w-full flex-wrap items-center gap-3 py-4">
    <Link href={`/users/${user.id}`} className="flex min-w-0 flex-1 basis-48 items-center gap-3 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30">
      <UserAvatar name={user.username} src={user.avatar} display={user.avatarDisplay} className="h-10 w-10 shrink-0" />
      <span className="min-w-0">
        <span className="block break-words text-sm font-medium text-foreground">{user.username}</span>
        <span className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <LevelBadge level={user.level} />
          {isOwner && known && (mutual || kind === "following") ? <span>{mutual ? "互相关注" : "已关注"}</span> : null}
        </span>
      </span>
    </Link>
    {isOwner ? known ? <div className="ml-auto flex flex-wrap justify-end gap-2" aria-label={`${user.username}的关系操作`}>
      <Button type="button" variant="outline" className="min-w-28" disabled={pending || needsReconciliation}
        pending={follow.isPending || unfollow.isPending}
        aria-label={`${user.viewerIsFollowing ? "取消关注" : "回关"}：${user.username}`}
        onClick={() => void act(user.viewerIsFollowing ? "unfollow" : "follow")}>
        {user.viewerIsFollowing ? "取消关注" : "回关"}
      </Button>
      {kind === "followers" ? <Button ref={triggerRef} type="button" variant="outline" className="min-w-28"
        disabled={pending || needsReconciliation} aria-label={`移除粉丝：${user.username}`}
        onClick={() => { setError(undefined); setConfirming(true); }}>移除粉丝</Button> : null}
    </div> : <span className="text-sm text-muted-foreground">关系状态暂不可用</span> : null}
    {isOwner && needsReconciliation && !confirming ? <div className="flex w-full items-center justify-end gap-2">
      <span className="text-sm text-muted-foreground">关系尚未核实</span>
      <Button type="button" variant="outline" pending={pending} onClick={() => void act("reconcile")}>刷新核实</Button>
    </div> : null}
    {isOwner && error && !confirming ? <p role="alert" className="w-full text-sm text-destructive">{error}</p> : null}
    <Dialog open={isOwner && confirming} disablePointerDismissal={pending} onOpenChange={(open) => { if (!pending) setConfirming(open); }}>
      <DialogPortal><DialogBackdrop /><DialogViewport>
        <DialogPopup className="max-w-sm space-y-4 p-6" initialFocus={cancelRef} finalFocus={triggerRef}>
          <DialogTitle className="break-words">移除粉丝「{user.username}」？</DialogTitle>
          <DialogDescription>移除后，对方将不再关注你。不会通知对方，对方仍可重新关注你。</DialogDescription>
          {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
          <DialogFooter>
            <Button ref={cancelRef} type="button" variant="outline" className="min-w-28" disabled={pending} onClick={() => setConfirming(false)}>取消</Button>
            {needsReconciliation
              ? <Button type="button" variant="outline" pending={pending} onClick={() => void act("reconcile")}>刷新核实</Button>
              : <Button type="button" variant="destructive" className="min-w-28" pending={pending} pendingLabel="移除中"
                onClick={() => void act("removeFollower")}>移除粉丝</Button>}
          </DialogFooter>
        </DialogPopup>
      </DialogViewport></DialogPortal>
    </Dialog>
  </li>;
}

export function UserFollowList({ userId, kind, onReady }: {
  userId: string;
  kind: FollowListKind;
  onReady?: () => void;
}) {
  const viewerScope = useViewerScope();
  const isOwner = viewerScope !== "anonymous" && viewerScope === userId;
  const { data: users, isLoading, isError, refetch } = useUserFollowList(userId, kind);
  const listRef = useRef<HTMLUListElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (!isLoading) onReady?.();
  }, [isLoading, onReady]);

  const pendingFocus = useRef<{ id: string; index: number; viewer: string } | null>(null);
  useEffect(() => {
    const removed = pendingFocus.current;
    if (!removed || removed.viewer !== viewerScope || !users || users.some((user) => user.id === removed.id)) return;
    const frame = requestAnimationFrame(() => {
      pendingFocus.current = null;
      const next = listRef.current?.children[removed.index] ?? listRef.current?.lastElementChild;
      (next?.querySelector("a") ?? headingRef.current)?.focus({ preventScroll: true });
    });
    return () => cancelAnimationFrame(frame);
  }, [users, viewerScope]);

  return <section aria-label={kind === "following" ? "关注列表" : "粉丝列表"}>
    <h2 ref={headingRef} tabIndex={-1} className="sr-only">{kind === "following" ? "关注列表" : "粉丝列表"}</h2>
    {isLoading ? <LoadingState label="" className="min-h-0 py-16" />
      : isError && !users ? <LoadError title="加载失败" onRetry={() => void refetch()} className="py-16" />
        : !users?.length ? <EmptyState title={kind === "following" ? "还没有关注任何人" : "还没有粉丝"} />
          : <ul ref={listRef} className="w-full divide-y divide-border">
            {users.map((user, index) => <FollowRow key={`${viewerScope}:${user.id}`} user={user} kind={kind} isOwner={isOwner}
              onRemoveIntent={() => { pendingFocus.current = { id: user.id, index, viewer: viewerScope }; }} />)}
          </ul>}
  </section>;
}
