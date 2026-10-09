import { assertTextLimit } from "./catalog";

export const MORSE: Readonly<Record<string, string>> = Object.fromEntries([
  ..."ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("").map((letter, index) => [letter, [".-", "-...", "-.-.", "-..", ".", "..-.", "--.", "....", "..", ".---", "-.-", ".-..", "--", "-.", "---", ".--.", "--.-", ".-.", "...", "-", "..-", "...-", ".--", "-..-", "-.--", "--.."][index]]),
  ..."0123456789".split("").map((letter, index) => [letter, ["-----", ".----", "..---", "...--", "....-", ".....", "-....", "--...", "---..", "----."][index]]),
  [".", ".-.-.-"], [",", "--..--"], ["?", "..--.."], ["'", ".----."], ["/", "-..-."], ["(", "-.--."], [")", "-.--.-"], [":", "---..."], ["=", "-...-"], ["+", ".-.-."], ["-", "-....-"], ['"', ".-..-."], ["@", ".--.-."], ["É", "..-.."],
]);
const REVERSE = Object.fromEntries(Object.entries(MORSE).map(([letter, code]) => [code, letter]));

export function encodeMorse(text: string): string {
  assertTextLimit(text);
  const normalized = text.replace(/\r\n?/g, "\n").replace(/[a-zé]/g, (letter) => letter.toUpperCase());
  const unknown = [...new Set(Array.from(normalized).filter((letter) => !/\s/u.test(letter) && !MORSE[letter]))];
  if (unknown.length) throw new Error(`国际摩斯不支持这些字符：${unknown.slice(0, 12).join(" ")}${unknown.length > 12 ? "…" : ""}`);
  return normalized.split("\n").map((line) => line.trim().split(/\s+/u).map((word) => Array.from(word).map((letter) => MORSE[letter]).join(" ")).join(" / ")).join("\n");
}
export function decodeMorse(text: string): string {
  assertTextLimit(text);
  return text.replace(/\r\n?/g, "\n").split("\n").map((line) => line.trim().split(/\s*\/\s*/).map((word) => {
    if (!word) return "";
    return word.trim().split(/\s+/u).map((code) => {
      if (!Object.hasOwn(REVERSE, code)) throw new Error(`无法识别码组：${code.slice(0, 20)}。请用空格分隔字符，用 / 分隔单词`);
      return REVERSE[code];
    }).join("");
  }).join(" ")).join("\n");
}
