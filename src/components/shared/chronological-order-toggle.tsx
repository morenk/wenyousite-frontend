"use client";

import { useId } from "react";
import type { ReplyOrder } from "@/api/reply-query";
import { Button } from "@/components/ui/button";
import { WenyouIcon } from "@/components/ui/wenyou-icon";
import { cn } from "@/lib/utils";

interface ChronologicalOrderToggleProps {
  order: ReplyOrder;
  onOrderChange: (order: ReplyOrder) => void;
  accessibleName: string;
  className?: string;
}

/** 动态评论、主楼层和独立楼中楼共用的一键时间顺序切换。 */
export function ChronologicalOrderToggle({
  order,
  onOrderChange,
  accessibleName,
  className,
}: ChronologicalOrderToggleProps) {
  const descriptionId = useId();
  const isNewestFirst = order === "NEWEST";
  const currentLabel = isNewestFirst ? "最新在前" : "最早在前";
  const nextLabel = isNewestFirst ? "最早在前" : "最新在前";

  return (
    <Button
      type="button"
      variant="ghost"
      size="compact"
      aria-label={accessibleName}
      aria-describedby={descriptionId}
      aria-pressed={isNewestFirst}
      title={`切换为${nextLabel}`}
      onClick={() => onOrderChange(isNewestFirst ? "OLDEST" : "NEWEST")}
      className={cn(
        "px-2 text-xs font-medium text-muted-foreground hover:text-foreground",
        className,
      )}
    >
      <WenyouIcon id="action.sort" className="size-3.5" />
      {currentLabel}
      <span id={descriptionId} className="sr-only">
        当前{currentLabel}，点击切换为{nextLabel}
      </span>
    </Button>
  );
}
