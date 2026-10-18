"use client";

import { useConfirm } from "@/components/ui/confirm-provider";
import { useNavigationGuard } from "@/hooks/use-navigation-guard";

export function useSettingsLeaveGuard(dirty: boolean, busy: boolean) {
  const confirm = useConfirm();
  useNavigationGuard({ dirty, busy, confirmLeave: () => confirm({
    title: "放弃未保存修改", description: "当前修改尚未保存，确定要放弃吗？",
    confirmLabel: "放弃修改", cancelLabel: "继续编辑", destructive: true,
  }) });
}
