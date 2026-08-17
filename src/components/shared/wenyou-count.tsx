import { formatWenyouCompactCount } from "@wenyousite/foundation/formatting";
import type { ComponentProps } from "react";

import { cn } from "@/lib/utils";

type WenyouCountProps = Omit<ComponentProps<"span">, "children"> & {
  value: number;
  label: string;
  /** 外层已经提供同一标签时关闭，避免辅助技术重复朗读。 */
  announceLabel?: boolean;
};

/** 统一“万/亿”紧凑计数；完整数字始终保留给辅助技术与鼠标提示。 */
export function WenyouCount({
  value,
  label,
  announceLabel = true,
  className,
  ...props
}: WenyouCountProps) {
  const exact = Number.isFinite(value) && value >= 0
    ? new Intl.NumberFormat("zh-CN").format(Math.trunc(value))
    : "—";
  return (
    <span
      aria-label={announceLabel ? `${label} ${exact}` : undefined}
      title={exact}
      className={cn("font-utility tabular-nums", className)}
      {...props}
    >
      {formatWenyouCompactCount(value)}
    </span>
  );
}
