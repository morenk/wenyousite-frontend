import { describe, expect, test } from "vitest";
import { formatWenyou } from "@/lib/wenyou";

describe("formatWenyou", () => {
  test("以 BigInt 安全格式化超出 Number 精度的整数升数", () => {
    expect(formatWenyou("9007199254740993")).toBe("9,007,199,254,740,993");
  });
});
