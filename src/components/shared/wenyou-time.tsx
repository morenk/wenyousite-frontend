"use client";

import {
  formatWenyouDate,
  formatWenyouExactTime,
  formatWenyouTime,
  type WenyouDateInput,
} from "@wenyousite/foundation/formatting";
import { useEffect, useState, type ComponentProps } from "react";

import { cn } from "@/lib/utils";

type WenyouTimeProps = Omit<ComponentProps<"time">, "children" | "dateTime" | "title" | "aria-label"> & {
  value: WenyouDateInput;
  /** 与可见时间、悬停日期和读屏日期共用的业务前缀。 */
  labelPrefix?: string;
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
export function WenyouTime({ value, mode = "content", labelPrefix = "", reference, className, ...props }: WenyouTimeProps) {
  const tick = useSharedClock(mode === "content" && reference === undefined);
  const formattedDate = mode === "exact" ? formatWenyouExactTime(value) : formatWenyouDate(value);
  const accessibleLabel = labelPrefix + formattedDate;

  return (
    <time
      dateTime={toDateTime(value)}
      title={accessibleLabel}
      aria-label={accessibleLabel}
      className={cn("font-utility tabular-nums", className)}
      suppressHydrationWarning
      {...props}
    >
      {labelPrefix}{mode === "exact" ? formattedDate : formatWenyouTime(value, reference ?? tick)}
    </time>
  );
}
