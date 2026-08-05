import { Dices } from "lucide-react";
import type { components } from "@/api/types";

export type DiceRollData = components["schemas"]["DiceRollResponseDto"];

interface DiceRollsProps {
  rolls?: DiceRollData[];
  pendingNotations?: string[];
  className?: string;
}

/** 正式结果与草稿待掷状态的静态展示。 */
export function DiceRolls({ rolls = [], pendingNotations = [], className }: DiceRollsProps) {
  if (rolls.length === 0 && pendingNotations.length === 0) return null;
  return (
    <div className={`space-y-2 ${className ?? ""}`}>
      {rolls.map((roll) => (
        <div
          key={roll.id}
          className="rounded-lg border border-primary/25 bg-primary/[0.05] px-3 py-2"
          data-testid="dice-roll-card"
        >
          <div className="flex items-center justify-between gap-3">
            <span className="flex items-center gap-1.5 font-mono text-sm font-semibold text-foreground">
              <Dices className="h-4 w-4 text-primary" />
              {roll.notation}
            </span>
            <span className="text-sm text-muted-foreground">
              总计 <strong className="ml-1 text-base text-foreground">{roll.total}</strong>
            </span>
          </div>
          <div className="mt-1.5 flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
            {roll.results.map((result, index) => (
              <span key={index} className="rounded border border-border bg-background px-1.5 py-0.5 tabular-nums">
                {result}
              </span>
            ))}
            {roll.modifier !== 0 && (
              <span className="ml-1 font-mono">
                {roll.modifier > 0 ? "+" : ""}{roll.modifier}
              </span>
            )}
          </div>
        </div>
      ))}
      {pendingNotations.map((notation, index) => (
        <div
          key={`${notation}-${index}`}
          className="flex items-center justify-between rounded-lg border border-dashed border-amber-500/40 bg-amber-500/[0.06] px-3 py-2"
        >
          <span className="flex items-center gap-1.5 font-mono text-sm">
            <Dices className="h-4 w-4 text-amber-600" />
            {notation}
          </span>
          <span className="text-xs text-amber-700 dark:text-amber-400">发布时掷骰</span>
        </div>
      ))}
    </div>
  );
}
