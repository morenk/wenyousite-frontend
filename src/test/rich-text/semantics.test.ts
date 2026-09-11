import { expect, test } from "vitest";
import { firstDifference } from "./semantics";
test("诊断定位第一个字段差异，不回显正文或 URL", () => {
  const original = { blocks: [{ text: "合成敏感占位", marks: { link: "https://example.invalid/private" } }] };
  const changed = { blocks: [{ text: "另一个合成占位", marks: { link: "https://example.invalid/changed" } }] };
  expect(firstDifference(original, changed)).toBe("$.blocks.0.text");
  expect(firstDifference(original, structuredClone(original))).toBeUndefined();
  expect(firstDifference({ blocks: [] }, original)).toBe("$.blocks.0");
});
