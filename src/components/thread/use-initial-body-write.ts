"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { getApiError } from "@/api/errors";

/** 首次 BODY 没有创建 UUID；未知结果只能重放同一请求，版本冲突交给显式载入流程。 */
export function useInitialBodyWrite<T>() {
  const frozen = useRef<T | null>(null);
  const [pendingRequest, setPendingRequest] = useState<T | null>(null);
  const [uncertain, setUncertain] = useState(false);
  const freeze = (request: T) => {
    if (!frozen.current) { frozen.current = request; setPendingRequest(request); }
    return frozen.current;
  };
  const finish = () => { frozen.current = null; setPendingRequest(null); setUncertain(false); };
  const fail = (error: unknown) => {
    const apiError = getApiError(error);
    if ((apiError.status !== undefined && apiError.status >= 400 && apiError.status < 500)
      || (apiError.code !== undefined && apiError.code >= 40000 && apiError.code < 50000)) finish();
    else if (frozen.current) setUncertain(true);
  };
  const canClose = useCallback(() => {
    if (!frozen.current) return true;
    toast.error("正文发表结果尚未确认，请先重试确认保存");
    return false;
  }, []);
  useEffect(() => {
    if (!pendingRequest) return;
    const protect = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", protect);
    return () => window.removeEventListener("beforeunload", protect);
  }, [pendingRequest]);
  return { pendingRequest, uncertain, freeze, finish, fail, canClose };
}
