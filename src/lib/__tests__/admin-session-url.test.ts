import { expect, it } from "vitest";
import { safeAdminLoginReturn, adminLoginHref } from "../admin-session-url";
it.each(["https://evil.test/station/users", "//evil.test/station/users", "/station", "/station/invite?token=secret", "/station/../login", "/station/users\\evil", "javascript:alert(1)"])("拒绝不安全管理回跳 %s", (path) => { expect(safeAdminLoginReturn(path)).toBe("/station/dashboard"); });
it("保留正常管理筛选且丢弃hash", () => { expect(safeAdminLoginReturn("/station/content?type=moment&authorId=u#x")).toBe("/station/content?type=moment&authorId=u"); expect(adminLoginHref("/station/users?q=test")).toBe("/station?returnTo=%2Fstation%2Fusers%3Fq%3Dtest"); });
