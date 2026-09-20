"use client";

import {
  formatWenyouExactTime,
  formatWenyouTime,
  type WenyouDateInput,
} from "@wenyousite/foundation/formatting";
import { useEffect, useState, type ComponentProps } from "react";

import { cn } from "@/lib/utils";

type WenyouTimeProps = Omit<ComponentProps<"time">, "children" | "dateTime" | "title"> & {
  value: WenyouDateInput;
  /** 内容时间使用相对窗口；账务、安全、审计与预约到期使用精确时刻。 */
  mode?: "content" | "exact";
  /** 仅供确定性预览与测试；真实界面默认跟随当前时间更新。 */
  reference?: WenyouDateInput;
};

const clockListeners = new Set<() => void>();
let clockTimer: number | undefined;
let currentClockTime = Date.now();

function refreshClock() {
  currentClockTime = Date.now();
  for (const listener of clockListeners) listener();
}

function refreshVisibleClock() {
  if (document.visibilityState === "visible") refreshClock();
}

function subscribeClock(listener: () => void) {
  clockListeners.add(listener);
  if (clockListeners.size === 1) {
    currentClockTime = Date.now();
    clockTimer = window.setInterval(refreshClock, 30_000);
    window.addEventListener("focus", refreshClock);
    document.addEventListener("visibilitychange", refreshVisibleClock);
  }
  listener();

  return () => {
    clockListeners.delete(listener);
    if (clockListeners.size > 0) return;
    if (clockTimer !== undefined) window.clearInterval(clockTimer);
    clockTimer = undefined;
    window.removeEventListener("focus", refreshClock);
    document.removeEventListener("visibilitychange", refreshVisibleClock);
  };
}

function useSharedClock(enabled: boolean) {
  const [now, setNow] = useState(() => new Date(Date.now()));

  useEffect(() => {
    if (!enabled) return;
    return subscribeClock(() => setNow(new Date(currentClockTime)));
  }, [enabled]);

  return now;
}

function toDateTime(value: WenyouDateInput): string | undefined {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return undefined;
  return typeof value === "string" ? value : date.toISOString();
}

/** 普通内容共用相对时间窗口，精确记录直接显示完整本地时刻。 */
export function WenyouTime({ value, mode = "content", reference, className, ...props }: WenyouTimeProps) {
  const tick = useSharedClock(mode === "content" && reference === undefined);

  return (
    <time
      dateTime={toDateTime(value)}
      title={formatWenyouExactTime(value)}
      className={cn("font-utility tabular-nums", className)}
      suppressHydrationWarning
      {...props}
    >
      {mode === "exact" ? formatWenyouExactTime(value) : formatWenyouTime(value, reference ?? tick)}
    </time>
  );
}
