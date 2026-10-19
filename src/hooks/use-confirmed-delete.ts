"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { getApiErrorMessage } from "@/api/errors";
import { useConfirm, type ConfirmOptions } from "@/components/ui/confirm-provider";

/** 用户内容删除的确认与并发保护；权限、请求及缓存仍由调用方负责。 */
export function useConfirmedDelete() {
  const confirm = useConfirm();
  const locked = useRef(false);
  const active = useRef(true);
  const [pending, setPending] = useState(false);
  useEffect(() => { active.current = true; return () => { active.current = false; }; }, []);

  const run = async (options: ConfirmOptions & { successMessage: string }, remove: () => Promise<unknown>, onDeleted?: () => void) => {
    if (locked.current) return;
    locked.current = true;
    setPending(true);
    try {
      if (!(await confirm({ ...options, confirmLabel: "删除", destructive: true })) || !active.current) return;
      await remove();
      toast.success(options.successMessage);
      onDeleted?.();
    } catch (error) {
      toast.error(getApiErrorMessage(error, "删除失败，请稍后重试"));
    } finally {
      locked.current = false;
      if (active.current) setPending(false);
    }
  };
  return { run, pending };
}
