import { expect, it } from "vitest";
import { safeAdminLoginReturn, adminLoginHref } from "../admin-session-url";
it.each(["https://evil.test/station/users", "//evil.test/station/users", "/station", "/station/invite?token=secret", "/station/../login", "/station/users\\evil", "javascript:alert(1)"])("拒绝不安全管理回跳 %s", (path) => { expect(safeAdminLoginReturn(path)).toBe("/station/dashboard"); });
it("保留正常管理筛选且丢弃hash", () => { expect(safeAdminLoginReturn("/station/content?type=moment&authorId=u#x")).toBe("/station/content?type=moment&authorId=u"); expect(adminLoginHref("/station/users?q=test")).toBe("/station?returnTo=%2Fstation%2Fusers%3Fq%3Dtest"); });
it("移动端版本说明登录后回到原页", () => {
  expect(safeAdminLoginReturn("/station/mobile-releases")).toBe("/station/mobile-releases");
  expect(adminLoginHref("/station/mobile-releases")).toBe("/station?returnTo=%2Fstation%2Fmobile-releases");
});
it("移动端版本说明回跳保留查询并丢弃 hash", () => {
  expect(safeAdminLoginReturn("/station/mobile-releases?platform=android#notes")).toBe("/station/mobile-releases?platform=android");
});
it.each([
  "/station/mobile-releases-extra",
  "/station/mobile-releases/unknown",
  "/station/mobile-releases%2Funknown",
  "/station/mobile-releases\\evil",
  "//evil.test/station/mobile-releases",
  "https://evil.test/station/mobile-releases",
])("移动端版本说明白名单拒绝相似或站外路径 %s", (path) => {
  expect(safeAdminLoginReturn(path)).toBe("/station/dashboard");
});
