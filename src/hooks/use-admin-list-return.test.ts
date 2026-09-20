import { describe, expect, it } from "vitest";
import { safeAdminReturnTo } from "./use-admin-list-return";

describe("管理列表返回地址", () => {
  it("只接受对应列表及其筛选参数", () => {
    expect(safeAdminReturnTo("/station/users?q=alice", "/station/users")).toBe("/station/users?q=alice");
    for (const path of ["//evil.test", "https://evil.test", "/station/users/other", "/station/content", null]) {
      expect(safeAdminReturnTo(path, "/station/users")).toBe("/station/users");
    }
  });
});
