export const MAX_DICE_ROLLS_PER_POST = 20;

export const DICE_NOTATION_LIMITS = {
  quantity: { minimum: 1, maximum: 100 },
  sides: { minimum: 2, maximum: 1000 },
  modifier: { minimum: -10000, maximum: 10000 },
} as const;

export interface DiceExpressionInput {
  quantity: string;
  sides: string;
  modifier: string;
}

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
    !Number.isSafeInteger(quantity) ||
    quantity < DICE_NOTATION_LIMITS.quantity.minimum ||
    quantity > DICE_NOTATION_LIMITS.quantity.maximum ||
    !Number.isSafeInteger(sides) ||
    sides < DICE_NOTATION_LIMITS.sides.minimum ||
    sides > DICE_NOTATION_LIMITS.sides.maximum ||
    !Number.isSafeInteger(modifier) ||
    modifier < DICE_NOTATION_LIMITS.modifier.minimum ||
    modifier > DICE_NOTATION_LIMITS.modifier.maximum
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

/** 将结构化输入组合为规范表达式；最终约束仍由后端在发布时校验。 */
export function composeDiceNotation(input: DiceExpressionInput): string | null {
  const quantity = input.quantity.trim();
  const sides = input.sides.trim();
  const modifier = input.modifier.trim();
  if (!/^\d+$/u.test(quantity) || !/^\d+$/u.test(sides) || !/^[+-]?\d+$/u.test(modifier)) {
    return null;
  }
  const modifierValue = Number(modifier);
  const modifierText = modifierValue > 0
    ? `+${modifierValue}`
    : modifierValue < 0
      ? String(modifierValue)
      : "";
  return parseDiceNotation(`${quantity}d${sides}${modifierText}`)?.notation ?? null;
}

export function getDiceNotationError(input: string): string | null {
  if (!input.trim()) return "请输入骰子表达式";
  if (!parseDiceNotation(input)) {
    return "请使用 NdM、NdM+K 或 NdM-K；每次 1–100 枚、2–1000 面";
  }
  return null;
}
