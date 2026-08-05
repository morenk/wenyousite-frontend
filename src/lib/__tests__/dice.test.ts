import { describe, expect, test } from "vitest";
import { getDiceNotationError, parseDiceNotation } from "@/lib/dice";

describe("parseDiceNotation", () => {
  test.each([
    ["d20", "1d20", 1, 20, 0],
    [" 2D6 + 3 ", "2d6+3", 2, 6, 3],
    ["100d1000-10000", "100d1000-10000", 100, 1000, -10000],
  ])("解析并规范化 %s", (input, notation, quantity, sides, modifier) => {
    expect(parseDiceNotation(input)).toEqual({ notation, quantity, sides, modifier });
  });

  test.each(["", "1d1", "101d6", "1d1001", "2d6*2", "2d6+10001", "999999999999999999d6"])(
    "拒绝超范围或非白名单表达式 %s",
    (input) => expect(parseDiceNotation(input)).toBeNull(),
  );

  test("错误文案区分空输入和非法表达式", () => {
    expect(getDiceNotationError(" ")).toBe("请输入骰子表达式");
    expect(getDiceNotationError("2d0")).toContain("NdM");
  });
});
