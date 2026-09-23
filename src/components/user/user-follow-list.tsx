"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Menu } from "@base-ui/react/menu";
import { Ellipsis } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useUserFollowList, type FollowListKind, type FollowUser } from "@/api/hooks/use-user-follow-list";
import { useFollowActions } from "@/api/hooks/use-follow-actions";
import { useApiMeta } from "@/api/hooks/use-api-meta";
import { useViewerScope } from "@/api/use-viewer-scope";
import { getAuthSnapshot } from "@/lib/auth-store";
import { UserAvatar } from "@/components/shared/user-avatar";
import { EmptyState } from "@/components/shared/empty-state";
import { LoadError } from "@/components/shared/load-error";
import { LoadingState } from "@/components/shared/loading-state";
import { LevelBadge } from "@/components/shared/level-badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogBackdrop, DialogDescription, DialogFooter, DialogPopup, DialogPortal, DialogTitle, DialogViewport } from "@/components/ui/dialog";
import { getApiErrorMessage } from "@/api/errors";

const menuItemClassName = "flex min-h-12 w-full cursor-default items-center rounded-lg px-3 py-2 text-sm outline-none select-none data-highlighted:bg-accent data-highlighted:text-accent-foreground data-disabled:text-muted-foreground";
const relationStatusClassName = "h-12 min-w-24 bg-muted px-3 text-muted-foreground hover:bg-accent aria-expanded:bg-muted aria-expanded:text-foreground";
type RowAction = "follow" | "unfollow" | "removeFollower" | "block" | "reconcile";

function FollowRow({ user, kind, isOwner, viewer, canMessage, onRemoveIntent }: {
  user: FollowUser;
  kind: FollowListKind;
  isOwner: boolean;
  viewer: string;
  canMessage: boolean;
  onRemoveIntent: () => void;
}) {
  const actions = useFollowActions(user.id);
  const { isPending, needsReconciliation } = actions;
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirming, setConfirming] = useState<"removeFollower" | "block" | null>(null);
  const [error, setError] = useState<string>();
  const [submitting, setSubmitting] = useState(false);
  const [focusRequest, setFocusRequest] = useState(0);
  const focused = useRef(0);
  const locked = useRef(false);
  const alive = useRef(true);
  const afterClose = useRef<(() => void) | null>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const returnFocus = useRef<HTMLElement | null>(null);
  const controlsRef = useRef<HTMLDivElement>(null);
  const pending = submitting || isPending;
  const known = typeof user.viewerIsFollowing === "boolean" && typeof user.viewerIsFollowedBy === "boolean";
  const mutual = user.viewerIsFollowing && user.viewerIsFollowedBy;
  // 目标权限失效后彻底丢弃旧交互，稍后再次关注不会复活旧确认。
  if ((menuOpen || confirming) && (!isOwner || !known || (confirming === "removeFollower" && !user.viewerIsFollowedBy))) {
    setMenuOpen(false);
    setConfirming(null);
  }
  const current = () => alive.current && isOwner && getAuthSnapshot().user?.id === viewer;
  useEffect(() => {
    alive.current = true;
    return () => { alive.current = false; afterClose.current = null; };
  }, []);
  useEffect(() => {
    if (!focusRequest || focused.current === focusRequest || pending || menuOpen || confirming) return;
    const frame = requestAnimationFrame(() => {
      if (!alive.current || !isOwner || getAuthSnapshot().user?.id !== viewer) return;
      focused.current = focusRequest;
      controlsRef.current?.querySelector<HTMLButtonElement>("button:not(:disabled)")?.focus({ preventScroll: true });
    });
    return () => cancelAnimationFrame(frame);
  }, [focusRequest, pending, menuOpen, confirming, isOwner, viewer]);
  const canConfirm = isOwner && known && (confirming !== "removeFollower" || user.viewerIsFollowedBy);

  async function act(action: RowAction) {
    if (locked.current || !current()) return;
    locked.current = true;
    setSubmitting(true);
    setError(undefined);
    if (action === "removeFollower" || action === "block" || (action === "unfollow" && kind === "following")) onRemoveIntent();
    try {
      await actions[action].mutateAsync();
      if (current()) setConfirming(null);
    } catch (error) {
      if (current()) setError(getApiErrorMessage(error, "操作失败，请稍后重试"));
    } finally {
      locked.current = false;
      if (alive.current) {
        setSubmitting(false);
        if (!confirming && current()) setFocusRequest((value) => value + 1);
      }
    }
  }
  function select(action: () => void) {
    afterClose.current = action;
    setMenuOpen(false);
  }
  const status = mutual ? "互相关注" : "已关注";
  const primary = user.viewerIsFollowedBy ? "回关" : "关注";
  const captureFocus = (event: React.FocusEvent<HTMLElement>) => { returnFocus.current = event.currentTarget; };

  return <li className="relative flex w-full min-h-18 items-center gap-3 py-3 after:absolute after:right-0 after:bottom-0 after:left-12 after:h-px after:bg-border last:after:hidden">
    <Link href={`/users/${user.id}`} className="flex min-w-0 flex-1 items-center gap-3 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30">
      <UserAvatar name={user.username} src={user.avatar} display={user.avatarDisplay} className="size-9 shrink-0" textClassName="text-sm" />
      <span className="min-w-0">
        <span className="block truncate text-sm font-medium text-foreground" title={user.username}>{user.username}</span>
        {isOwner && error ? <span role="alert" className="block truncate text-xs text-destructive" title={error}>{error}</span>
          : <span className="mt-1 flex items-center text-xs text-muted-foreground"><LevelBadge level={user.level} /></span>}
      </span>
    </Link>
    {isOwner ? <Menu.Root open={menuOpen && isOwner && known && !pending && !needsReconciliation}
      onOpenChange={(open) => { if (!open || (!pending && !needsReconciliation && current())) setMenuOpen(open); }}
      onOpenChangeComplete={(open) => {
        if (open) return;
        const action = afterClose.current;
        afterClose.current = null;
        if (current() && known) action?.();
      }}>
      <div ref={controlsRef} className="flex shrink-0 items-center gap-1">
        {needsReconciliation ? <Button type="button" variant="secondary" className={relationStatusClassName} pending={pending}
          aria-label={`刷新核实：${user.username}`} onClick={() => void act("reconcile")}>刷新核实</Button>
          : !known ? <Button type="button" variant="secondary" className={relationStatusClassName} disabled>状态未知</Button>
            : user.viewerIsFollowing ? <Menu.Trigger onFocus={captureFocus} disabled={pending}
              render={<Button type="button" variant="secondary" className={relationStatusClassName} pending={pending} aria-label={`${status}：${user.username}`} />}>
              {status}
            </Menu.Trigger>
              : <Button type="button" variant="default" className="h-12 min-w-24 px-3" pending={pending}
                aria-label={`${primary}：${user.username}`} onClick={() => void act("follow")}>{primary}</Button>}
        <Menu.Trigger onFocus={captureFocus} disabled={pending || needsReconciliation || !known}
          render={<Button type="button" variant="ghost" size="icon" className="size-12" aria-label={`更多操作：${user.username}`} />}>
          <Ellipsis className="size-4" aria-hidden="true" />
        </Menu.Trigger>
      </div>
      <Menu.Portal><Menu.Positioner anchor={controlsRef} side="bottom" align="end" sideOffset={4} className="z-[var(--layer-popup)]">
        <Menu.Popup aria-label={`${user.username}的操作`} finalFocus={() => afterClose.current ? false : returnFocus.current}
          className="w-52 rounded-xl border border-border bg-popover p-1 text-popover-foreground shadow-popover outline-none">
          {canMessage ? <Menu.Item className={menuItemClassName} onClick={() => select(() => router.push(`/messages/new/${user.id}`))}>私聊</Menu.Item> : null}
          {user.viewerIsFollowing ? <Menu.Item className={menuItemClassName} onClick={() => select(() => void act("unfollow"))}>取消关注</Menu.Item> : null}
          {user.viewerIsFollowedBy ? <Menu.Item className={menuItemClassName} onClick={() => select(() => { setError(undefined); setConfirming("removeFollower"); })}>移除粉丝</Menu.Item> : null}
          <Menu.Item className={menuItemClassName} onClick={() => select(() => { setError(undefined); setConfirming("block"); })}>拉黑</Menu.Item>
          <Menu.Item className={menuItemClassName} onClick={() => select(() => router.push(`/report?targetType=USER&targetId=${encodeURIComponent(user.id)}`))}>举报</Menu.Item>
        </Menu.Popup>
      </Menu.Positioner></Menu.Portal>
    </Menu.Root> : null}
    <Dialog open={!!confirming && !!canConfirm} disablePointerDismissal={pending} onOpenChange={(open) => { if (!open && !pending) setConfirming(null); }}>
      <DialogPortal><DialogBackdrop /><DialogViewport>
        <DialogPopup className="max-w-sm space-y-4 p-6" initialFocus={cancelRef} finalFocus={returnFocus}>
          <DialogTitle className="break-words">{confirming === "block" ? `拉黑「${user.username}」？` : `移除粉丝「${user.username}」？`}</DialogTitle>
          <DialogDescription>{confirming === "block" ? "拉黑后，双方内容和私聊将互相隐藏，历史记录与关注关系保留。" : "移除后，对方将不再关注你。不会通知对方，对方仍可重新关注你。"}</DialogDescription>
          {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
          <DialogFooter>
            <Button ref={cancelRef} type="button" variant="outline" className="h-12 min-w-24" disabled={pending} onClick={() => setConfirming(null)}>取消</Button>
            {needsReconciliation
              ? <Button type="button" variant="secondary" className="h-12" pending={pending} onClick={() => void act("reconcile")}>刷新核实</Button>
              : <Button type="button" variant="destructive" className="h-12 min-w-24" pending={pending} pendingLabel={confirming === "block" ? "拉黑中" : "移除中"}
                onClick={() => { if (confirming && canConfirm) void act(confirming); }}>{confirming === "block" ? "拉黑" : "移除粉丝"}</Button>}
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
  const { data: meta } = useApiMeta();
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
          : <ul ref={listRef} className="w-full">
            {users.map((user, index) => <FollowRow key={`${viewerScope}:${user.id}`} user={user} kind={kind} isOwner={isOwner} viewer={viewerScope} canMessage={meta?.capabilities?.directMessages === true}
              onRemoveIntent={() => { pendingFocus.current = { id: user.id, index, viewer: viewerScope }; }} />)}
          </ul>}
  </section>;
}
