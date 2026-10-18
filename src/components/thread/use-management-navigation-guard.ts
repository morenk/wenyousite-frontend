"use client";

import { useNavigationGuard } from "@/hooks/use-navigation-guard";

/** 管理界面保留正文 flush、保存锁及版本复核，共享浏览器导航拦截。 */
export function useManagementNavigationGuard({ hasUnsavedChanges, isNavigationLocked, confirmDiscardChanges }: {
  hasUnsavedChanges: boolean;
  isNavigationLocked: boolean;
  confirmDiscardChanges: () => Promise<boolean>;
}) {
  useNavigationGuard({ dirty: hasUnsavedChanges, busy: isNavigationLocked, confirmLeave: confirmDiscardChanges });
}
