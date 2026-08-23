/** 主题帖编辑入口：统一登录提示、轻量触发器与编辑器挂载容器。 */

"use client";

import { LogIn } from "lucide-react";

import { ThreadComposerOutlet } from "@/components/thread/thread-composer";
import {
  useThreadComposer,
  type ThreadComposerSession,
} from "@/components/thread/thread-composer-context";
import { Button } from "@/components/ui/button";
import { WenyouIcon, type WenyouIconId } from "@/components/ui/wenyou-icon";
import { useLoginRedirect } from "@/hooks/use-login-redirect";
import { useAuth } from "@/lib/auth";

interface ThreadComposerEntryProps {
  anchorId: string;
  iconId: WenyouIconId;
  composerSession: ThreadComposerSession;
}

export function ThreadComposerEntry({
  anchorId,
  iconId,
  composerSession,
}: ThreadComposerEntryProps) {
  const { user } = useAuth();
  const redirectToLogin = useLoginRedirect();
  const { session, open } = useThreadComposer();
  const isActive = session?.anchorId === anchorId;

  if (!user) {
    return (
      <div className="rounded-xl border border-border bg-card p-4">
        <Button variant="outline" size="sm" onClick={() => redirectToLogin()}>
          <LogIn className="mr-1.5 h-4 w-4" />
          登录后参与讨论
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-3 rounded-xl border border-border bg-card p-4">
      {!isActive ? (
        <Button
          type="button"
          variant="outline"
          className="w-full justify-start text-muted-foreground"
          onClick={() => void open(composerSession)}
        >
          <WenyouIcon id={iconId} className="mr-2 size-4" />
          发表回复…
        </Button>
      ) : null}
      <ThreadComposerOutlet anchorId={anchorId} />
    </div>
  );
}
