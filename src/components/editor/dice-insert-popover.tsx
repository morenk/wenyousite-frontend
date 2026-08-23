"use client";

import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DICE_NOTATION_LIMITS,
  composeDiceNotation,
  type DiceExpressionInput,
} from "@/lib/dice";
import {
  DICE_INSERTION_PRESENTATION,
  formatInlineDicePending,
} from "@/lib/dice-inline";

interface DiceInsertPopoverProps {
  position: { top: number; left: number } | null;
  count: number;
  maxCount: number;
  input: DiceExpressionInput;
  onInputChange: (input: DiceExpressionInput) => void;
  onInsert: (notation: string) => void;
}

/** 编辑器骰子插入浮层；定位与 ProseMirror 事务仍由宿主控制。 */
export function DiceInsertPopover({
  position,
  count,
  maxCount,
  input,
  onInputChange,
  onInsert,
}: DiceInsertPopoverProps) {
  if (!position) return null;
  const presentation = DICE_INSERTION_PRESENTATION;
  const notation = composeDiceNotation(input);
  const limitReached = count >= maxCount;
  const update = (field: keyof DiceExpressionInput, value: string) => {
    onInputChange({ ...input, [field]: value });
  };

  return createPortal(
    <form
      data-dice-popover
      role="dialog"
      aria-label={presentation.title}
      className="fixed z-[var(--layer-nested-popup)] max-h-[calc(100vh-1rem)] w-[min(20rem,calc(100vw-1rem))] overflow-y-auto overscroll-contain rounded-xl border border-border bg-popover p-3 text-popover-foreground shadow-popover"
      style={{ top: position.top, left: position.left }}
      onSubmit={(event) => {
        event.preventDefault();
        if (notation && !limitReached) onInsert(notation);
      }}
    >
      <div className="flex items-center justify-between gap-3 text-sm font-bold">
        <span>{presentation.title}</span>
        <span className="font-utility text-xs font-normal tabular-nums text-muted-foreground">
          {count}/{maxCount}
        </span>
      </div>

      <fieldset className="mt-3 grid grid-cols-2 gap-2">
        <legend className="sr-only">骰子表达式</legend>
        <label className="grid gap-1 text-xs text-muted-foreground">
          {presentation.fieldLabels.quantity}
          <Input
            autoFocus
            type="number"
            inputMode="numeric"
            min={DICE_NOTATION_LIMITS.quantity.minimum}
            max={DICE_NOTATION_LIMITS.quantity.maximum}
            step={1}
            value={input.quantity}
            onChange={(event) => update("quantity", event.target.value)}
            className="h-9 font-utility tabular-nums"
          />
        </label>
        <label className="grid gap-1 text-xs text-muted-foreground">
          {presentation.fieldLabels.sides}
          <Input
            type="number"
            inputMode="decimal"
            min={DICE_NOTATION_LIMITS.sides.minimum}
            max={DICE_NOTATION_LIMITS.sides.maximum}
            step={1}
            value={input.sides}
            onChange={(event) => update("sides", event.target.value)}
            className="h-9 font-utility tabular-nums"
          />
        </label>
        <label className="col-span-2 grid gap-1 text-xs text-muted-foreground">
          {presentation.fieldLabels.modifier}
          <Input
            type="number"
            inputMode="numeric"
            min={DICE_NOTATION_LIMITS.modifier.minimum}
            max={DICE_NOTATION_LIMITS.modifier.maximum}
            step={1}
            value={input.modifier}
            onChange={(event) => update("modifier", event.target.value)}
            className="h-9 font-utility tabular-nums"
          />
        </label>
      </fieldset>

      <div className="mt-3 flex flex-wrap gap-1.5" aria-label="常用面数">
        {presentation.quickSides.map((sides) => (
          <Button
            key={sides}
            type="button"
            variant={input.sides === String(sides) ? "secondary" : "outline"}
            size="sm"
            className="h-7 px-2 font-utility text-xs"
            onClick={() => update("sides", String(sides))}
          >
            d{sides}
          </Button>
        ))}
      </div>

      <div
        className="mt-3 flex items-center justify-between gap-3 rounded-lg bg-muted/60 px-2.5 py-2"
        aria-live="polite"
      >
        <div className="min-w-0">
          <span className="block text-[0.6875rem] text-muted-foreground">预览</span>
          {notation ? (
            <span className="dice-inline dice-inline-pending mt-0.5">
              {formatInlineDicePending(notation)}
            </span>
          ) : (
            <span className="text-xs text-destructive">请检查数值与范围</span>
          )}
        </div>
        <Button
          type="submit"
          size="sm"
          className="h-8 shrink-0 px-3"
          disabled={limitReached || !notation}
        >
          插入
        </Button>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        {limitReached ? `已达到每帖 ${maxCount} 个骰子上限` : "发布后生成结果"}
      </p>
    </form>,
    document.body,
  );
}
