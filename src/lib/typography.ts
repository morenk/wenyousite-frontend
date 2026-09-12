import type { CSSProperties } from "react";
import { TYPOGRAPHY_FAMILIES } from "@wenyousite/foundation/typography";

/** Foundation 提供通用家族关键字；不加引号，以保留浏览器系统字体解析。 */
export const FOUNDATION_FONT_VARIABLES = Object.fromEntries(
  Object.entries(TYPOGRAPHY_FAMILIES).map(([role, { family, fallback }]) => [
    `--wenyou-font-${role}-family`,
    [family, ...fallback].join(", "),
  ]),
) as CSSProperties;
