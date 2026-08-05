export const MAX_DICE_ROLLS_PER_POST = 20;

export interface ParsedDiceNotation {
  notation: string;
  quantity: number;
  sides: number;
  modifier: number;
}

export function parseDiceNotation(input: string): ParsedDiceNotation | null {
  const match = /^\s*(?:(\d+)\s*)?[dD]\s*(\d+)(?:\s*([+-])\s*(\d+))?\s*$/.exec(input);
  if (!match) return null;
  const quantity = Number(match[1] ?? 1);
  const sides = Number(match[2]);
  const magnitude = Number(match[4] ?? 0);
  const modifier = match[3] === "-" ? -magnitude : magnitude;
  if (
    !Number.isSafeInteger(quantity) || quantity < 1 || quantity > 100 ||
    !Number.isSafeInteger(sides) || sides < 2 || sides > 1000 ||
    !Number.isSafeInteger(modifier) || Math.abs(modifier) > 10000
  ) {
    return null;
  }
  const modifierText = modifier > 0 ? `+${modifier}` : modifier < 0 ? `${modifier}` : "";
  return {
    notation: `${quantity}d${sides}${modifierText}`,
    quantity,
    sides,
    modifier,
  };
}

export function getDiceNotationError(input: string): string | null {
  if (!input.trim()) return "请输入骰子表达式";
  if (!parseDiceNotation(input)) {
    return "请使用 NdM、NdM+K 或 NdM-K；每次 1–100 枚、2–1000 面";
  }
  return null;
}
