import { describe, expect, it } from "vitest";
import { boundedAdminPageIndex } from "@/lib/admin-url-state";

describe("管理员列表 URL 状态", () => {
  it("把越界页码限制在当前结果范围内", () => {
    expect(boundedAdminPageIndex(-3, 25, 10)).toBe(0);
    expect(boundedAdminPageIndex(2, 25, 10)).toBe(1);
    expect(boundedAdminPageIndex(99, 25, 10)).toBe(2);
    expect(boundedAdminPageIndex(99, 0, 10)).toBe(0);
  });
});
