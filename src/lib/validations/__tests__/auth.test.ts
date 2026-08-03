/** auth Zod 校验 schema 测试 */

import { describe, test, expect } from "vitest";
import {
  loginSchema,
  emailSchema,
  registerStep2Schema,
  forgotPasswordSchema,
  resetPasswordSchema,
  verifyEmailSchema,
  changePasswordSchema,
  changeEmailSchema,
} from "@/lib/validations/auth";

describe("loginSchema", () => {
  test("合法邮箱密码通过", () => {
    const result = loginSchema.safeParse({
      email: "test@example.com",
      password: "Test123456",
    });
    expect(result.success).toBe(true);
  });

  test("邮箱为空", () => {
    const result = loginSchema.safeParse({ email: "", password: "Test123456" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toMatch(/邮箱/);
    }
  });

  test("邮箱格式错误", () => {
    const result = loginSchema.safeParse({
      email: "not-email",
      password: "Test123456",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toMatch(/邮箱格式不正确/);
    }
  });

  test("密码为空", () => {
    const result = loginSchema.safeParse({
      email: "test@example.com",
      password: "",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toMatch(/密码/);
    }
  });

  test("密码不足 8 位", () => {
    const result = loginSchema.safeParse({
      email: "test@example.com",
      password: "1234567",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toMatch(/密码至少 8 位/);
    }
  });

  test("密码刚好 8 位通过", () => {
    const result = loginSchema.safeParse({
      email: "test@example.com",
      password: "12345678",
    });
    expect(result.success).toBe(true);
  });
});

describe("emailSchema", () => {
  test("合法邮箱通过", () => {
    expect(emailSchema.safeParse({ email: "a@b.com" }).success).toBe(true);
  });

  test("邮箱为空", () => {
    const result = emailSchema.safeParse({ email: "" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toMatch(/邮箱/);
    }
  });

  test("邮箱格式错误", () => {
    const result = emailSchema.safeParse({ email: "abc" });
    expect(result.success).toBe(false);
  });
});

describe("registerStep2Schema", () => {
  test("合法输入通过", () => {
    const result = registerStep2Schema.safeParse({
      code: "123456",
      username: "张三",
      password: "Abcd1234",
    });
    expect(result.success).toBe(true);
  });

  test("验证码不足 6 位", () => {
    const result = registerStep2Schema.safeParse({
      code: "12345",
      username: "张三",
      password: "Abcd1234",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toMatch(/验证码为 6 位数字/);
    }
  });

  test("验证码含非数字", () => {
    const result = registerStep2Schema.safeParse({
      code: "12345a",
      username: "张三",
      password: "Abcd1234",
    });
    expect(result.success).toBe(false);
  });

  test("用户名不足 2 位", () => {
    const result = registerStep2Schema.safeParse({
      code: "123456",
      username: "A",
      password: "Abcd1234",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toMatch(/用户名至少 2 位/);
    }
  });

  test("用户名超过 24 位", () => {
    const result = registerStep2Schema.safeParse({
      code: "123456",
      username: "A".repeat(25),
      password: "Abcd1234",
    });
    expect(result.success).toBe(false);
  });

  test("用户名含特殊字符", () => {
    const result = registerStep2Schema.safeParse({
      code: "123456",
      username: "name@!",
      password: "Abcd1234",
    });
    expect(result.success).toBe(false);
  });

  test("密码不含字母", () => {
    const result = registerStep2Schema.safeParse({
      code: "123456",
      username: "张三",
      password: "12345678",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toMatch(/字母/);
    }
  });

  test("密码不含数字", () => {
    const result = registerStep2Schema.safeParse({
      code: "123456",
      username: "张三",
      password: "Abcdefgh",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toMatch(/数字/);
    }
  });
});

describe("forgotPasswordSchema", () => {
  test("合法邮箱通过", () => {
    expect(
      forgotPasswordSchema.safeParse({ email: "test@test.com" }).success,
    ).toBe(true);
  });

  test("邮箱为空", () => {
    const result = forgotPasswordSchema.safeParse({ email: "" });
    expect(result.success).toBe(false);
  });
});

describe("resetPasswordSchema", () => {
  test("合法输入通过", () => {
    const result = resetPasswordSchema.safeParse({
      email: "test@test.com",
      token: "123456",
      newPassword: "Abcd1234",
    });
    expect(result.success).toBe(true);
  });

  test("验证码不足 6 位", () => {
    const result = resetPasswordSchema.safeParse({
      email: "test@test.com",
      token: "123",
      newPassword: "Abcd1234",
    });
    expect(result.success).toBe(false);
  });

  test("新密码不足 8 位", () => {
    const result = resetPasswordSchema.safeParse({
      email: "test@test.com",
      token: "123456",
      newPassword: "Ab12",
    });
    expect(result.success).toBe(false);
  });
});

describe("verifyEmailSchema", () => {
  test("合法验证码通过", () => {
    expect(verifyEmailSchema.safeParse({ token: "123456" }).success).toBe(true);
  });

  test("验证码不足 6 位", () => {
    const result = verifyEmailSchema.safeParse({ token: "12" });
    expect(result.success).toBe(false);
  });

  test("验证码含非数字", () => {
    const result = verifyEmailSchema.safeParse({ token: "abcdef" });
    expect(result.success).toBe(false);
  });
});

describe("changePasswordSchema", () => {
  const valid = {
    oldPassword: "OldPass123",
    newPassword: "NewPass456",
    confirmPassword: "NewPass456",
  };

  test("合法输入通过", () => {
    expect(changePasswordSchema.safeParse(valid).success).toBe(true);
  });

  test("当前密码为空", () => {
    const result = changePasswordSchema.safeParse({ ...valid, oldPassword: "" });
    expect(result.success).toBe(false);
  });

  test("新密码不足 8 位", () => {
    const result = changePasswordSchema.safeParse({
      ...valid,
      newPassword: "New1",
      confirmPassword: "New1",
    });
    expect(result.success).toBe(false);
  });

  test("新密码缺少字母或数字", () => {
    expect(changePasswordSchema.safeParse({ ...valid, newPassword: "12345678", confirmPassword: "12345678" }).success).toBe(false);
    expect(changePasswordSchema.safeParse({ ...valid, newPassword: "abcdefgh", confirmPassword: "abcdefgh" }).success).toBe(false);
  });

  test("两次新密码不一致", () => {
    const result = changePasswordSchema.safeParse({
      ...valid,
      confirmPassword: "Different1",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].path).toContain("confirmPassword");
    }
  });
});

describe("changeEmailSchema", () => {
  test("合法输入通过", () => {
    expect(
      changeEmailSchema.safeParse({ newEmail: "new@example.com", code: "123456" }).success,
    ).toBe(true);
  });

  test("邮箱格式错误", () => {
    const result = changeEmailSchema.safeParse({ newEmail: "bad", code: "123456" });
    expect(result.success).toBe(false);
  });

  test("验证码不足 6 位或含非数字", () => {
    expect(changeEmailSchema.safeParse({ newEmail: "new@example.com", code: "123" }).success).toBe(false);
    expect(changeEmailSchema.safeParse({ newEmail: "new@example.com", code: "abcdef" }).success).toBe(false);
  });
});
