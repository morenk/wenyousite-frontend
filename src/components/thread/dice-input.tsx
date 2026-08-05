"use client";

import { useState } from "react";
import { Dices, Plus, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  getDiceNotationError,
  MAX_DICE_ROLLS_PER_POST,
  parseDiceNotation,
} from "@/lib/dice";

const QUICK_SIDES = [4, 6, 8, 10, 12, 20, 100];

interface DiceInputProps {
  value: string[];
  onChange: (value: string[]) => void;
  existingCount?: number;
  disabled?: boolean;
}

/** 待掷骰子编辑器；只组织表达式，绝不在客户端生成正式结果。 */
export function DiceInput({
  value,
  onChange,
  existingCount = 0,
  disabled = false,
}: DiceInputProps) {
  const [customNotation, setCustomNotation] = useState("1d20");
  const remaining = MAX_DICE_ROLLS_PER_POST - existingCount - value.length;

  const addNotation = (input: string) => {
    if (remaining <= 0) {
      toast.error(`每个帖子最多包含 ${MAX_DICE_ROLLS_PER_POST} 次骰子结果`);
      return;
    }
    const error = getDiceNotationError(input);
    if (error) {
      toast.error(error);
      return;
    }
    const parsed = parseDiceNotation(input)!;
    onChange([...value, parsed.notation]);
  };

  return (
    <div className="space-y-2 rounded-lg border border-dashed border-border bg-muted/20 p-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 text-sm font-medium text-foreground">
          <Dices className="h-4 w-4 text-primary" />
          待掷骰子
        </div>
        <span className="text-xs text-muted-foreground">
          {existingCount + value.length}/{MAX_DICE_ROLLS_PER_POST}
        </span>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {QUICK_SIDES.map((sides) => (
          <Button
            key={sides}
            type="button"
            variant="outline"
            size="sm"
            className="h-7 px-2 text-xs"
            disabled={disabled || remaining <= 0}
            onClick={() => addNotation(`1d${sides}`)}
          >
            d{sides}
          </Button>
        ))}
      </div>

      <div className="flex gap-2">
        <Input
          value={customNotation}
          onChange={(event) => setCustomNotation(event.target.value)}
          onKeyDown={(event) => {
            if (event.key !== "Enter") return;
            event.preventDefault();
            addNotation(customNotation);
          }}
          placeholder="例如 2d6+3"
          aria-label="自定义骰子表达式"
          className="h-8 font-mono text-sm"
          disabled={disabled}
        />
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className="h-8"
          disabled={disabled || remaining <= 0}
          onClick={() => addNotation(customNotation)}
        >
          <Plus className="mr-1 h-3.5 w-3.5" />
          添加骰子
        </Button>
      </div>

      {value.length > 0 && (
        <div className="flex flex-wrap gap-1.5" aria-label="待掷骰子列表">
          {value.map((notation, index) => (
            <span
              key={`${notation}-${index}`}
              className="inline-flex items-center gap-1 rounded-md bg-primary/10 px-2 py-1 font-mono text-xs text-primary"
            >
              {notation}
              <button
                type="button"
                className="rounded-sm hover:bg-primary/15"
                aria-label={`移除待掷骰子 ${notation}`}
                disabled={disabled}
                onClick={() => onChange(value.filter((_, itemIndex) => itemIndex !== index))}
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}
      <p className="text-[11px] text-muted-foreground">
        提交成功后才由服务器掷骰；结果生成后不可修改。
      </p>
    </div>
  );
}
