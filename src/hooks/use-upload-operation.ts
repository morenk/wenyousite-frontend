"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type UploadOperationPhase = "preparing" | "uploading" | "saving";

/** 只管理一次操作的生命周期；文件缓存、批量顺序和业务保存仍由调用方负责。 */
export function useUploadOperation() {
  const active = useRef<{ controller: AbortController; phase: UploadOperationPhase } | null>(null);
  const mounted = useRef(true);
  const [phase, setPhase] = useState<UploadOperationPhase | null>(null);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      active.current?.controller.abort();
      active.current = null;
    };
  }, []);

  const start = useCallback((initialPhase: UploadOperationPhase = "preparing") => {
    if (!mounted.current || active.current) return null;
    const operation = { controller: new AbortController(), phase: initialPhase };
    active.current = operation;
    setPhase(initialPhase);
    const isCurrent = () => mounted.current && active.current === operation && !operation.controller.signal.aborted;
    return {
      signal: operation.controller.signal,
      isCurrent,
      setPhase(next: UploadOperationPhase) {
        if (!isCurrent()) return;
        operation.phase = next;
        setPhase(next);
      },
      finish() {
        if (active.current !== operation) return;
        active.current = null;
        if (mounted.current) setPhase(null);
      },
    };
  }, []);

  const cancel = useCallback(() => {
    // 已发出的业务保存不能通过取消上传撤回。
    if (!active.current || active.current.phase === "saving") return false;
    active.current.controller.abort();
    active.current = null;
    if (mounted.current) setPhase(null);
    return true;
  }, []);

  const invalidate = useCallback(() => {
    // 页面离开只丢弃本地回调，不能撤回已经发出的保存请求。
    active.current?.controller.abort();
    active.current = null;
    if (mounted.current) setPhase(null);
  }, []);

  const isPending = useCallback(() => active.current !== null, []);
  const isSaving = useCallback(() => active.current?.phase === "saving", []);
  return { phase, pending: phase !== null, start, cancel, invalidate, isPending, isSaving };
}
