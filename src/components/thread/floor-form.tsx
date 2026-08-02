/** 楼层发布入口：点击后才按需挂载详情页唯一 Markdown 编辑器 */

"use client";

import { useRouter } from "next/navigation";
import { LogIn, MessageSquare } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useThreadComposer } from "@/components/thread/thread-composer-context";
import { ThreadComposerOutlet } from "@/components/thread/thread-composer";
import { Button } from "@/components/ui/button";

interface FloorFormProps {
  subthreadId: string;
}

export function FloorForm({ subthreadId }: FloorFormProps) {
  const { user } = useAuth();
  const router = useRouter();
  const { session, open } = useThreadComposer();
  const anchorId = `create-floor:${subthreadId}`;
  const isActive = session?.anchorId === anchorId;

  if (!user) {
    return (
      <div className="rounded-xl border border-border bg-card p-4">
        <p className="mb-3 text-sm text-muted-foreground">
          登录后即可参与讨论
        </p>
        <Button
          variant="outline"
          size="sm"
          onClick={() => router.push("/login")}
        >
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
            type: "create-floor",
            subthreadId,
            label: "发表回复",
            initialContent: "",
          })}
        >
          <MessageSquare className="mr-2 h-4 w-4" />
          发表回复…
        </Button>
      )}
      <ThreadComposerOutlet anchorId={anchorId} />
    </div>
  );
}
