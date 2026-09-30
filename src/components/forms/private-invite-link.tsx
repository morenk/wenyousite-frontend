"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { ClipboardCopy, KeyRound, Loader2, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { useCreateInviteLink, useEnsureInviteLink } from "@/api/hooks/use-thread-access-actions";
import { API_ERROR_CODE, getApiError, getApiErrorMessage } from "@/api/errors";
import { useViewerScope } from "@/api/use-viewer-scope";
import { getAuthSnapshot, subscribeAuthStore } from "@/lib/auth-store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useConfirm } from "@/components/ui/confirm-provider";

interface PrivateInviteLinkProps {
  threadId: string;
  ownerId: string;
  unavailableReason?: string;
  disabled: boolean;
}

/** 凭据仅存于当前楼主、帖子和路由绑定的控件内存，身份切换时销毁。 */
export function PrivateInviteLink(props: PrivateInviteLinkProps) {
  const viewer = useViewerScope();
  const pathname = usePathname();
  if (viewer === "anonymous" || viewer !== props.ownerId) return null;
  return <InviteActions key={`${viewer}:${props.threadId}:${pathname}:${props.unavailableReason ?? "ready"}`} {...props} viewer={viewer} />;
}

function InviteActions({ threadId, viewer, unavailableReason, disabled }: PrivateInviteLinkProps & { viewer: string }) {
  const ensureInvite = useEnsureInviteLink();
  const resetInvite = useCreateInviteLink();
  const confirm = useConfirm();
  const [busy, setBusy] = useState(false);
  const [url, setUrl] = useState<string>();
  const [feedback, setFeedback] = useState<string>();
  const busyRef = useRef(false);
  const mounted = useRef(false);
  useLayoutEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  async function share(reset: boolean) {
    if (busyRef.current || disabled || unavailableReason || getAuthSnapshot().user?.id !== viewer) return;
    busyRef.current = true;
    setBusy(true);
    let valid = true;
    const dispose = subscribeAuthStore(() => {
      if (getAuthSnapshot().user?.id !== viewer) valid = false;
    });
    const current = () => valid && mounted.current && getAuthSnapshot().user?.id === viewer;
    try {
      if (reset && !(await confirm({
        title: "重置邀请链接",
        description: "旧邀请链接将立即失效，已加入成员的权限不受影响。",
        confirmLabel: "重置并复制",
      }))) return;
      if (!current()) return;
      // 每次读取服务端当前值，开始请求后不继续展示可能已被其他设备重置的旧凭据。
      setUrl(undefined);
      setFeedback(undefined);
      let invite;
      let recovered = false;
      try {
        invite = await (reset ? resetInvite : ensureInvite).mutateAsync(threadId);
      } catch (error) {
        if (!current()) return;
        const { code, status } = getApiError(error);
        const uncertain = code === undefined && (status === undefined || status >= 500)
          || (code !== undefined && code >= 50000)
          || code === API_ERROR_CODE.TOKEN_EXPIRED;
        if (!reset || !uncertain) {
          const message = `${reset ? "重置" : "获取"}邀请链接失败：${getApiErrorMessage(error, "请稍后重试")}`;
          setFeedback(message);
          toast.error(message);
          return;
        }
        // POST 可能已生效；只重新读取当前值，绝不自动再次轮换。
        try {
          invite = await ensureInvite.mutateAsync(threadId);
          recovered = true;
        } catch {
          if (current()) {
            const message = "重置结果未确认，当前链接暂时无法获取。请稍后点击“复制邀请链接”重试。";
            setFeedback(message);
            toast.error(message);
          }
          return;
        }
      }
      if (!current()) return;
      const nextUrl = `${window.location.origin}/join/${invite.token}`;
      setUrl(nextUrl);
      const message = recovered ? "重置结果未确认，已取回当前邀请链接。" : reset ? "邀请链接已重置，旧链接已失效。" : "";
      try {
        await navigator.clipboard.writeText(nextUrl);
        if (current()) {
          setFeedback(`${message}邀请链接已复制。`);
          if (recovered) toast.message("重置结果未确认，当前邀请链接已复制");
          else toast.success(reset ? "新邀请链接已复制，旧链接已失效" : "邀请链接已复制");
        }
      } catch {
        if (current()) {
          const copyError = `${message}邀请链接已获取，但自动复制失败，请手动复制下方链接。`;
          setFeedback(copyError);
          toast.error(copyError);
        }
      }
    } finally {
      dispose();
      ensureInvite.reset();
      resetInvite.reset();
      busyRef.current = false;
      if (mounted.current) setBusy(false);
    }
  }

  return <section aria-label="私密访问" aria-busy={busy} className="rounded-[var(--radius-panel)] border border-border bg-card p-4">
    <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
      <KeyRound className="size-4 text-brand-strong" />私密访问
    </div>
    <Button type="button" variant="outline" size="compact" className="mt-3 w-full"
      disabled={!!unavailableReason || busy || disabled} onClick={() => void share(false)}>
      {busy ? <Loader2 className="animate-spin" /> : <ClipboardCopy />}复制邀请链接
    </Button>
    <Button type="button" variant="ghost" size="compact" className="mt-2 w-full"
      disabled={!!unavailableReason || busy || disabled} onClick={() => void share(true)}>
      <RotateCcw />重置邀请链接
    </Button>
    {unavailableReason ? <p className="mt-2 text-xs text-warning">{unavailableReason}</p> : null}
    {feedback ? <p role="status" className="mt-2 text-xs leading-5 text-muted-foreground">{feedback}</p> : null}
    {url ? <Input aria-label="当前邀请链接" className="mt-2" readOnly value={url} onFocus={(event) => event.currentTarget.select()} /> : null}
  </section>;
}
