/** api client 401 会话过期判定测试 */

import { describe, test, expect } from "vitest";
import { isSessionExpired401 } from "@/api/client";

describe("isSessionExpired401", () => {
  test("业务 401（登录密码错误）即使无 token 也不按会话过期处理", () => {
    expect(isSessionExpired401(401, "/api/v1/auth/login", null)).toBe(false);
  });

  test("业务 401（注册/重置/验证码错误）不按会话过期处理", () => {
    expect(
      isSessionExpired401(401, "/api/v1/auth/register/verify-and-complete", null),
    ).toBe(false);
    expect(isSessionExpired401(401, "/api/v1/auth/reset-password", null)).toBe(false);
    expect(isSessionExpired401(401, "/api/v1/auth/verify-email", "Bearer x")).toBe(false);
  });

  test("业务 401（改密/换邮箱）即使携带 token 也不按会话过期处理", () => {
    expect(isSessionExpired401(401, "/api/v1/auth/change-password", "Bearer x")).toBe(false);
    expect(
      isSessionExpired401(401, "/api/v1/auth/change-email/request-code", "Bearer x"),
    ).toBe(false);
    expect(isSessionExpired401(401, "/api/v1/auth/change-email/verify", "Bearer x")).toBe(false);
  });

  test("携带 token 的普通接口 401 判定为会话过期", () => {
    expect(isSessionExpired401(401, "/api/v1/threads/1", "Bearer x")).toBe(true);
    expect(isSessionExpired401(401, "/api/v1/notifications", "Bearer x")).toBe(true);
  });

  test("未携带 token 的普通接口 401 不判定为会话过期", () => {
    expect(isSessionExpired401(401, "/api/v1/threads/1", null)).toBe(false);
  });

  test("非 401 状态码永不判定为会话过期", () => {
    expect(isSessionExpired401(403, "/api/v1/threads/1", "Bearer x")).toBe(false);
    expect(isSessionExpired401(404, "/api/v1/threads/1", "Bearer x")).toBe(false);
    expect(isSessionExpired401(200, "/api/v1/threads/1", "Bearer x")).toBe(false);
  });
});
