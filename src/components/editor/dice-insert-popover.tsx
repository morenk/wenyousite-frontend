"use client";

import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface DiceInsertPopoverProps {
  position: { top: number; left: number } | null;
  count: number;
  maxCount: number;
  quickSides: readonly number[];
  notation: string;
  onNotationChange: (value: string) => void;
  onInsert: (notation: string) => void;
}

/** 编辑器骰子插入浮层；定位与 ProseMirror 事务仍由宿主控制。 */
export function DiceInsertPopover({
  position,
  count,
  maxCount,
  quickSides,
  notation,
  onNotationChange,
  onInsert,
}: DiceInsertPopoverProps) {
  if (!position) return null;
  const limitReached = count >= maxCount;
  return createPortal(
    <div
      data-dice-popover
      role="dialog"
      aria-label="插入骰子"
      className="fixed z-[100] w-72 rounded-lg border border-border bg-popover p-3 text-popover-foreground shadow-popover"
      style={{ top: position.top, left: position.left }}
    >
      <div className="mb-2 flex items-center justify-between gap-3 text-sm font-medium">
        <span>插入骰子</span>
        <span className="text-xs font-normal text-muted-foreground">
          {count}/{maxCount}
        </span>
      </div>
      <div className="mb-2 flex flex-wrap gap-1.5">
        {quickSides.map((sides) => (
          <Button
            key={sides}
            type="button"
            variant="outline"
            size="sm"
            className="h-7 px-2 text-xs"
            disabled={limitReached}
            onClick={() => onInsert(`1d${sides}`)}
          >
            d{sides}
          </Button>
        ))}
      </div>
      <div className="flex gap-2">
        <Input
          autoFocus
          value={notation}
          onChange={(event) => onNotationChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key !== "Enter") return;
            event.preventDefault();
            onInsert(notation);
          }}
          className="h-8"
          aria-label="自定义骰子表达式"
          placeholder="例如 2d6+3"
        />
        <Button
          type="button"
          size="sm"
          className="h-8 px-3"
          disabled={limitReached}
          onClick={() => onInsert(notation)}
        >
          插入
        </Button>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">提交后由服务器生成结果</p>
    </div>,
    document.body,
  );
}
