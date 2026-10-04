"use client";

import { toast } from "sonner";
import { getApiErrorMessage } from "@/api/errors";
import { useSetThreadIdentityEnabled } from "@/api/hooks/use-thread-identity";
import { Button } from "@/components/ui/button";
import { useConfirm } from "@/components/ui/confirm-provider";

export function ThreadIdentitySettings({ threadId, enabled, disabled }: { threadId: string; enabled: boolean; disabled?: boolean }) {
  const update = useSetThreadIdentityEnabled(threadId);
  const confirm = useConfirm();
  const toggle = async () => {
    if (update.isPending || disabled) return;
    if (enabled && !await confirm({
      title: "关闭帖内身份",
      description: "全帖将显示站内资料。角色资料与历史记录保留，重新开启后恢复。",
      confirmLabel: "关闭帖内身份",
    })) return;
    try { await update.mutateAsync(!enabled); toast.success(enabled ? "已关闭帖内身份" : "已启用帖内身份"); }
    catch (error) { toast.error(getApiErrorMessage(error, "设置失败，请重试")); }
  };
  return <section className="space-y-3 rounded-[var(--radius-panel)] border border-border bg-muted/25 p-4">
    <h2 className="font-sans text-lg font-semibold text-foreground">帖内身份</h2>
    <p className="text-xs leading-5 text-muted-foreground">楼主、协作者和玩家可设置仅用于本主题及其全部子贴的头像与昵称。</p>
    <Button type="button" variant={enabled ? "secondary" : "outline"} size="sm" aria-pressed={enabled}
      onClick={() => void toggle()} disabled={disabled} pending={update.isPending}>
      {enabled ? "关闭帖内身份" : "启用帖内身份"}
    </Button>
  </section>;
}
