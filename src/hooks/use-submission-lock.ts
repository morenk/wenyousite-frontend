"use client";

import { useCallback, useRef, useState } from "react";

/** 只串行化本次挂载的写入；字段校验、业务权限和错误处理仍归调用方。 */
export function useSubmissionLock() {
  const inFlight = useRef(false);
  const [pending, setPending] = useState(false);
  const guard = useCallback(<Args extends unknown[]>(action: (...args: Args) => Promise<unknown>) => async (...args: Args) => {
    if (inFlight.current) return;
    inFlight.current = true;
    setPending(true);
    try { await action(...args); }
    finally { inFlight.current = false; setPending(false); }
  }, []);
  return { pending, guard };
}
