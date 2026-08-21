/** 楼中楼回复入口：登录后按需挂载统一 Markdown 编辑器 */

"use client";

import { LogIn } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useThreadComposer } from "@/components/thread/thread-composer-context";
import { ThreadComposerOutlet } from "@/components/thread/thread-composer";
import { Button } from "@/components/ui/button";
import { WenyouIcon } from "@/components/ui/wenyou-icon";
import { useLoginRedirect } from "@/hooks/use-login-redirect";

interface ReplyFormProps {
  subthreadId: string;
  parentPostId: string;
  replyToPostId: string;
  label: string;
}

export function getReplyComposerAnchorId(parentPostId: string) {
  return `create-reply:${parentPostId}`;
}

export function ReplyForm({
  subthreadId,
  parentPostId,
  replyToPostId,
  label,
}: ReplyFormProps) {
  const { user } = useAuth();
  const redirectToLogin = useLoginRedirect();
  const { session, open } = useThreadComposer();
  const anchorId = getReplyComposerAnchorId(parentPostId);
  const isActive = session?.anchorId === anchorId;

  if (!user) {
    return (
      <div className="rounded-xl border border-border bg-card p-4">
        <p className="mb-3 text-sm text-muted-foreground">登录后即可参与讨论</p>
        <Button variant="outline" size="sm" onClick={() => redirectToLogin()}>
          <LogIn className="mr-1.5 h-4 w-4" />
          登录
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-3 rounded-xl border border-border bg-card p-4">
      {!isActive && (
        <Button
          type="button"
          variant="outline"
          className="w-full justify-start text-muted-foreground"
          onClick={() => open({
            key: anchorId,
            anchorId,
            type: "reply",
            subthreadId,
            parentPostId,
            replyToPostId,
            label,
            initialContent: "",
          })}
        >
          <WenyouIcon id="action.reply" className="mr-2 size-4" />
          发表回复…
        </Button>
      )}
      <ThreadComposerOutlet anchorId={anchorId} />
    </div>
  );
}
