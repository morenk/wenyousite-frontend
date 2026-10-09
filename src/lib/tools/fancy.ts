import { assertTextLimit } from "./catalog";

export const FANCY_STYLES = [
  { id: "bold", label: "粗体", upper: 0x1d400, lower: 0x1d41a, digit: 0x1d7ce },
  { id: "italic", label: "斜体", upper: 0x1d434, lower: 0x1d44e },
  { id: "script", label: "花体", upper: 0x1d49c, lower: 0x1d4b6 },
  { id: "fraktur", label: "哥特体", upper: 0x1d504, lower: 0x1d51e },
  { id: "double", label: "双线体", upper: 0x1d538, lower: 0x1d552, digit: 0x1d7d8 },
  { id: "mono", label: "等宽体", upper: 0x1d670, lower: 0x1d68a, digit: 0x1d7f6 },
  { id: "full", label: "全角", upper: 0xff21, lower: 0xff41, digit: 0xff10 },
] as const;
export type FancyStyle = (typeof FANCY_STYLES)[number]["id"];
const exceptions: Partial<Record<FancyStyle, Record<string, string>>> = {
  italic: { h: "ℎ" },
  script: { B: "ℬ", E: "ℰ", F: "ℱ", H: "ℋ", I: "ℐ", L: "ℒ", M: "ℳ", R: "ℛ", e: "ℯ", g: "ℊ", o: "ℴ" },
  fraktur: { C: "ℭ", H: "ℌ", I: "ℑ", R: "ℜ", Z: "ℨ" },
  double: { C: "ℂ", H: "ℍ", N: "ℕ", P: "ℙ", Q: "ℚ", R: "ℝ", Z: "ℤ" },
};
export function fancyText(text: string, id: FancyStyle): string {
  assertTextLimit(text);
  const style = FANCY_STYLES.find((item) => item.id === id)!;
  return Array.from(text, (char) => {
    if (exceptions[id]?.[char]) return exceptions[id]![char];
    const code = char.codePointAt(0)!;
    if (code >= 65 && code <= 90) return String.fromCodePoint(style.upper + code - 65);
    if (code >= 97 && code <= 122) return String.fromCodePoint(style.lower + code - 97);
    if (code >= 48 && code <= 57 && "digit" in style) return String.fromCodePoint(style.digit + code - 48);
    return char;
  }).join("");
}
