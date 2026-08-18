import { describe, expect, test } from "vitest";
import { composeDiceNotation, getDiceNotationError, parseDiceNotation } from "@/lib/dice";

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

  test("结构化输入省略零修正并规范化正负修正", () => {
    expect(composeDiceNotation({ quantity: "2", sides: "6", modifier: "0" })).toBe("2d6");
    expect(composeDiceNotation({ quantity: "2", sides: "6", modifier: "+3" })).toBe("2d6+3");
    expect(composeDiceNotation({ quantity: "2", sides: "6", modifier: "-3" })).toBe("2d6-3");
  });

  test("结构化输入拒绝小数、空字段和超出后端范围的数值", () => {
    expect(composeDiceNotation({ quantity: "2.5", sides: "6", modifier: "0" })).toBeNull();
    expect(composeDiceNotation({ quantity: "", sides: "6", modifier: "0" })).toBeNull();
    expect(composeDiceNotation({ quantity: "101", sides: "6", modifier: "0" })).toBeNull();
  });
});
