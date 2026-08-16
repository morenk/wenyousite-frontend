/** auth Zod 校验 schema 测试 */

import { describe, test, expect } from "vitest";
import {
  loginSchema,
  emailSchema,
  registerStep2Schema,
  forgotPasswordSchema,
  resetPasswordSchema,
  changePasswordSchema,
  changeEmailSchema,
} from "@/lib/validations/auth";

describe("loginSchema", () => {
  test("合法邮箱密码通过", () => {
    const result = loginSchema.safeParse({
      account: "test@example.com",
      password: "Test123456",
    });
    expect(result.success).toBe(true);
  });

  test("合法用户名密码通过", () => {
    const result = loginSchema.safeParse({
      account: "zhangsan",
      password: "Test123456",
    });
    expect(result.success).toBe(true);
  });

  test("中文用户名密码通过", () => {
    const result = loginSchema.safeParse({
      account: "张三",
      password: "Test123456",
    });
    expect(result.success).toBe(true);
  });

  test("账号为空", () => {
    const result = loginSchema.safeParse({ account: "", password: "Test123456" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toMatch(/邮箱或用户名/);
    }
  });

  test("邮箱格式错误", () => {
    const result = loginSchema.safeParse({
      account: "test@@example.com",
      password: "Test123456",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toMatch(/邮箱格式不正确/);
    }
  });

  test("不含 @ 的非法账号按用户名校验", () => {
    const result = loginSchema.safeParse({
      account: "not-email",
      password: "Test123456",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toMatch(/用户名/);
    }
  });

  test("用户名过短（1 位）不通过", () => {
    const result = loginSchema.safeParse({
      account: "A",
      password: "Test123456",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toMatch(/用户名/);
    }
  });

  test("用户名过长（25 位）不通过", () => {
    const result = loginSchema.safeParse({
      account: "A".repeat(25),
      password: "Test123456",
    });
    expect(result.success).toBe(false);
  });

  test("用户名含特殊字符不通过", () => {
    const result = loginSchema.safeParse({
      account: "name@!",
      password: "Test123456",
    });
    expect(result.success).toBe(false);
  });

  test("用户名含下划线不通过（与后端注册规则一致）", () => {
    const result = loginSchema.safeParse({
      account: "foo_bar",
      password: "Test123456",
    });
    expect(result.success).toBe(false);
  });

  test("密码为空", () => {
    const result = loginSchema.safeParse({
      account: "test@example.com",
      password: "",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toMatch(/密码/);
    }
  });

  test("密码不足 8 位", () => {
    const result = loginSchema.safeParse({
      account: "test@example.com",
      password: "1234567",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toMatch(/密码至少 8 位/);
    }
  });

  test("密码刚好 8 位通过", () => {
    const result = loginSchema.safeParse({
      account: "test@example.com",
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
  const valid = {
    code: "123456",
    username: "张三",
    password: "Abcd1234",
  };

  test("合法输入通过", () => {
    const result = registerStep2Schema.safeParse({
      ...valid,
      confirmPassword: "Abcd1234",
    });
    expect(result.success).toBe(true);
  });

  test("确认密码为空", () => {
    const result = registerStep2Schema.safeParse({
      ...valid,
      confirmPassword: "",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toMatch(/再次输入密码/);
    }
  });

  test("两次密码不一致", () => {
    const result = registerStep2Schema.safeParse({
      ...valid,
      confirmPassword: "Different1",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].path).toContain("confirmPassword");
      expect(result.error.issues[0].message).toMatch(/不一致/);
    }
  });

  test("验证码不足 6 位", () => {
    const result = registerStep2Schema.safeParse({
      ...valid,
      code: "12345",
      confirmPassword: "Abcd1234",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toMatch(/验证码为 6 位数字/);
    }
  });

  test("验证码含非数字", () => {
    const result = registerStep2Schema.safeParse({
      ...valid,
      code: "12345a",
      confirmPassword: "Abcd1234",
    });
    expect(result.success).toBe(false);
  });

  test("用户名不足 2 位", () => {
    const result = registerStep2Schema.safeParse({
      ...valid,
      username: "A",
      confirmPassword: "Abcd1234",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toMatch(/用户名至少 2 位/);
    }
  });

  test("用户名超过 24 位", () => {
    const result = registerStep2Schema.safeParse({
      ...valid,
      username: "A".repeat(25),
      confirmPassword: "Abcd1234",
    });
    expect(result.success).toBe(false);
  });

  test("用户名含特殊字符", () => {
    const result = registerStep2Schema.safeParse({
      ...valid,
      username: "name@!",
      confirmPassword: "Abcd1234",
    });
    expect(result.success).toBe(false);
  });

  test("密码不含字母", () => {
    const result = registerStep2Schema.safeParse({
      ...valid,
      password: "12345678",
      confirmPassword: "12345678",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toMatch(/字母/);
    }
  });

  test("密码不含数字", () => {
    const result = registerStep2Schema.safeParse({
      ...valid,
      password: "Abcdefgh",
      confirmPassword: "Abcdefgh",
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
  const valid = { oldPassword: "CurrentPass123", newEmail: "new@example.com", code: "123456" };

  test("合法输入通过", () => {
    expect(changeEmailSchema.safeParse(valid).success).toBe(true);
  });

  test("当前密码为空", () => {
    const result = changeEmailSchema.safeParse({ ...valid, oldPassword: "" });
    expect(result.success).toBe(false);
  });

  test("邮箱格式错误", () => {
    const result = changeEmailSchema.safeParse({ ...valid, newEmail: "bad" });
    expect(result.success).toBe(false);
  });

  test("验证码不足 6 位或含非数字", () => {
    expect(changeEmailSchema.safeParse({ ...valid, code: "123" }).success).toBe(false);
    expect(changeEmailSchema.safeParse({ ...valid, code: "abcdef" }).success).toBe(false);
  });
});
