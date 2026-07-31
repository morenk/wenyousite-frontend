/** cn() 工具函数测试 */

import { describe, test, expect } from "vitest";
import { cn } from "@/lib/utils";

describe("cn()", () => {
  test("合并多个类名", () => {
    expect(cn("foo", "bar")).toBe("foo bar");
  });

  test("过滤 falsy 值", () => {
    expect(cn("foo", false, undefined, null, "", "bar")).toBe("foo bar");
  });

  test("处理条件类名", () => {
    expect(cn("base", true && "active", false && "hidden")).toBe("base active");
  });

  test("使用 tailwind-merge 去重冲突的 tailwind 类", () => {
    expect(cn("px-4 px-6")).toBe("px-6");
    expect(cn("text-red-500 text-blue-500")).toBe("text-blue-500");
  });
});
