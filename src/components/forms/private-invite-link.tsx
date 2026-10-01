"use client";

import { useId, useLayoutEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { ClipboardCopy, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useEnsureInviteLink } from "@/api/hooks/use-thread-access-actions";
import { getApiErrorMessage } from "@/api/errors";
import { useViewerScope } from "@/api/use-viewer-scope";
import { getAuthSnapshot, subscribeAuthStore } from "@/lib/auth-store";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

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
  const [busy, setBusy] = useState(false);
  const [manualUrl, setManualUrl] = useState<string>();
  const feedbackId = useId();
  const busyRef = useRef(false);
  const mounted = useRef(false);
  useLayoutEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  async function copy() {
    if (busyRef.current || disabled || unavailableReason || getAuthSnapshot().user?.id !== viewer) return;
    busyRef.current = true;
    setBusy(true);
    setManualUrl(undefined);
    let valid = true;
    const dispose = subscribeAuthStore(() => {
      if (getAuthSnapshot().user?.id !== viewer) valid = false;
    });
    const current = () => valid && mounted.current && getAuthSnapshot().user?.id === viewer;
    try {
      let invite;
      try {
        // 每次读取服务端当前值；失败不回退到会轮换凭据的旧 POST。
        invite = await ensureInvite.mutateAsync(threadId);
      } catch (error) {
        if (current()) toast.error(`获取邀请链接失败，请重试：${getApiErrorMessage(error, "暂时无法连接服务")}`);
        return;
      }
      if (!current()) return;
      const url = `${window.location.origin}/join/${invite.token}`;
      try {
        await navigator.clipboard.writeText(url);
        if (current()) toast.success("邀请链接已复制");
      } catch {
        if (current()) setManualUrl(url);
      }
    } finally {
      dispose();
      ensureInvite.reset();
      busyRef.current = false;
      if (mounted.current) setBusy(false);
    }
  }

  return <div aria-busy={busy} className="space-y-2">
    <Button type="button" variant="outline" size="compact" className="w-full"
      disabled={!!unavailableReason || busy || disabled} title={unavailableReason}
      aria-describedby={manualUrl ? feedbackId : undefined} onClick={() => void copy()}>
      {busy ? <Loader2 className="animate-spin" /> : <ClipboardCopy />}复制邀请链接
    </Button>
    {manualUrl ? <>
      <p id={feedbackId} role="status" className="text-xs leading-5 text-muted-foreground">自动复制失败，请手动复制下方链接。</p>
      <Textarea aria-label="当前邀请链接" aria-describedby={feedbackId} className="min-h-0 resize-none break-all" rows={2} readOnly value={manualUrl} onFocus={(event) => event.currentTarget.select()} />
    </> : null}
  </div>;
}
