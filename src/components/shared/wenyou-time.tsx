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

/** 列表与详情共用的 72 小时相对时间；完整本地时间始终保留在 title。 */
export function WenyouTime({ value, reference, className, ...props }: WenyouTimeProps) {
  const tick = useSharedClock(reference === undefined);

  return (
    <time
      dateTime={toDateTime(value)}
      title={formatWenyouExactTime(value)}
      className={cn("font-utility tabular-nums", className)}
      suppressHydrationWarning
      {...props}
    >
      {formatWenyouTime(value, reference ?? tick)}
    </time>
  );
}
