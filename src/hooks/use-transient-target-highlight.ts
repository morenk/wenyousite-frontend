"use client";

import { useEffect, useState } from "react";

export const TRANSIENT_TARGET_HIGHLIGHT_HOLD_MS = 1_200;

/** 定位目标只短暂显示强调边框；目标或本次定位序号变化时重新计时。 */
export function useTransientTargetHighlight(
  targetId?: string,
  activationKey?: string | number,
): boolean {
  const [visible, setVisible] = useState(() => Boolean(targetId));

  useEffect(() => {
    if (!targetId) return;

    const activationTimer = window.setTimeout(() => {
      setVisible(true);
    }, 0);
    const expirationTimer = window.setTimeout(() => {
      setVisible(false);
    }, TRANSIENT_TARGET_HIGHLIGHT_HOLD_MS);

    return () => {
      window.clearTimeout(activationTimer);
      window.clearTimeout(expirationTimer);
    };
  }, [activationKey, targetId]);

  return Boolean(targetId) && visible;
}
