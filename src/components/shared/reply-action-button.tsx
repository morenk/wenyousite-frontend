"use client";

import type { MouseEventHandler } from "react";
import { Button } from "@/components/ui/button";
import { Tooltip } from "@/components/ui/tooltip";
import { WenyouIcon } from "@/components/ui/wenyou-icon";
import { cn } from "@/lib/utils";

interface ReplyActionButtonProps {
  onClick: MouseEventHandler<HTMLButtonElement>;
  label?: string;
  presentation?: "icon" | "labeled";
  disabled?: boolean;
  className?: string;
}

/** 内容卡片统一回复动作：固定消费 Foundation action.reply 语义。 */
export function ReplyActionButton({
  onClick,
  label = "回复",
  presentation = "icon",
  disabled = false,
  className,
}: ReplyActionButtonProps) {
  const button = (
    <Button
      type="button"
      variant="ghost"
      size={presentation === "labeled" ? "compact" : "icon-sm"}
      aria-label={presentation === "icon" ? label : undefined}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "rounded-lg text-muted-foreground hover:bg-primary hover:text-brand-strong focus-visible:bg-primary focus-visible:text-brand-strong",
        presentation === "labeled" && "text-xs font-medium",
        className,
      )}
    >
      <WenyouIcon id="action.reply" className="size-4" />
      {presentation === "labeled" ? <span>{label}</span> : null}
    </Button>
  );

  return presentation === "icon" ? (
    <Tooltip content={label} disabled={disabled}>
      {button}
    </Tooltip>
  ) : button;
}
