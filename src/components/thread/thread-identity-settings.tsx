"use client";

import { toast } from "sonner";
import { getApiErrorMessage } from "@/api/errors";
import { useSetThreadIdentityEnabled } from "@/api/hooks/use-thread-identity";
import { Button } from "@/components/ui/button";
import { SettingsGroup } from "@/components/user/settings-controls";
import { StackListRow } from "@/components/ui/stack-list";
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
  return <SettingsGroup>
    <StackListRow className="flex min-w-0 items-center justify-between gap-3 py-4">
      <span className="text-sm font-medium text-foreground">帖内身份</span>
      <Button type="button" variant={enabled ? "secondary" : "outline"} size="sm" aria-pressed={enabled}
        aria-label={enabled ? "关闭帖内身份" : "启用帖内身份"}
        onClick={() => void toggle()} disabled={disabled} pending={update.isPending}>
        {enabled ? "已开启" : "未开启"}
      </Button>
    </StackListRow>
  </SettingsGroup>;
}
