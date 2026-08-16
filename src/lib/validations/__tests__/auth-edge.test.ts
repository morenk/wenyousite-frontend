/** auth Zod 校验 schema — 扩展边界测试 */

import { describe, test, expect } from "vitest";
import {
  loginSchema,
  emailSchema,
  registerStep2Schema,
  forgotPasswordSchema,
  resetPasswordSchema,
} from "@/lib/validations/auth";

describe("loginSchema 边界", () => {
  test("邮箱含空格 trim 后仍为非法", () => {
    const result = loginSchema.safeParse({
      account: " not@email.com ",
      password: "Test123456",
    });
    expect(result.success).toBe(false);
  });

  test("密码长度为 100", () => {
    const result = loginSchema.safeParse({
      account: "a@b.com",
      password: "A".repeat(100),
    });
    expect(result.success).toBe(true);
  });

  test("邮箱含中文", () => {
    const result = loginSchema.safeParse({
      account: "测试@example.com",
      password: "Test123456",
    });
    expect(result.success).toBe(false);
  });

  test("邮箱缺少 @", () => {
    const result = loginSchema.safeParse({
      account: "testexample.com",
      password: "Test123456",
    });
    expect(result.success).toBe(false);
  });

  test("两端都是 undefined", () => {
    const result = loginSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  test("用户名含非字母数字中文字符不通过", () => {
    const result = loginSchema.safeParse({
      account: "张三😀",
      password: "Test123456",
    });
    expect(result.success).toBe(false);
  });

  test("用户名含前导/尾随空格不通过", () => {
    const result = loginSchema.safeParse({
      account: " zhangsan ",
      password: "Test123456",
    });
    expect(result.success).toBe(false);
  });

  test("24 位用户名恰好通过", () => {
    const result = loginSchema.safeParse({
      account: "A".repeat(24),
      password: "Test123456",
    });
    expect(result.success).toBe(true);
  });

  test("2 位用户名恰好通过", () => {
    const result = loginSchema.safeParse({
      account: "张三",
      password: "Test123456",
    });
    expect(result.success).toBe(true);
  });

  test("含下划线的类邮箱输入仍走邮箱校验", () => {
    const result = loginSchema.safeParse({
      account: "a_b@example.com",
      password: "Test123456",
    });
    expect(result.success).toBe(true);
  });
});

describe("registerStep2Schema 边界", () => {
  test("用户名刚好 2 位汉字", () => {
    const result = registerStep2Schema.safeParse({
      code: "123456",
      username: "你好",
      password: "Abcd1234",
      confirmPassword: "Abcd1234",
    });
    expect(result.success).toBe(true);
  });

  test("用户名刚好 24 位", () => {
    const result = registerStep2Schema.safeParse({
      code: "123456",
      username: "A".repeat(24),
      password: "Abcd1234",
      confirmPassword: "Abcd1234",
    });
    expect(result.success).toBe(true);
  });

  test("用户名含下划线不通过（与后端注册规则一致）", () => {
    const result = registerStep2Schema.safeParse({
      code: "123456",
      username: "test_user",
      password: "Abcd1234",
      confirmPassword: "Abcd1234",
    });
    expect(result.success).toBe(false);
  });

  test("密码 7 位含字母数字", () => {
    const result = registerStep2Schema.safeParse({
      code: "123456",
      username: "张三",
      password: "Abc1234",
      confirmPassword: "Abc1234",
    });
    expect(result.success).toBe(false);
  });

  test("验证码含前导空格", () => {
    const result = registerStep2Schema.safeParse({
      code: " 123456",
      username: "张三",
      password: "Abcd1234",
      confirmPassword: "Abcd1234",
    });
    expect(result.success).toBe(false);
  });

  test("验证码 7 位数字", () => {
    const result = registerStep2Schema.safeParse({
      code: "1234567",
      username: "张三",
      password: "Abcd1234",
      confirmPassword: "Abcd1234",
    });
    expect(result.success).toBe(false);
  });

  test("密码只有大写字母+数字", () => {
    const result = registerStep2Schema.safeParse({
      code: "123456",
      username: "张三",
      password: "ABCD1234",
      confirmPassword: "ABCD1234",
    });
    expect(result.success).toBe(true); // 含字母和数字即可
  });

  test("密码只有小写字母+数字", () => {
    const result = registerStep2Schema.safeParse({
      code: "123456",
      username: "张三",
      password: "abcd1234",
      confirmPassword: "abcd1234",
    });
    expect(result.success).toBe(true);
  });

  test("密码只有字母无数字", () => {
    const result = registerStep2Schema.safeParse({
      code: "123456",
      username: "张三",
      password: "Abcdefgh",
      confirmPassword: "Abcdefgh",
    });
    expect(result.success).toBe(false);
  });

  test("密码达到 100 位", () => {
    const result = registerStep2Schema.safeParse({
      code: "123456",
      username: "张三",
      password: "Abcdefg1" + "X".repeat(92),
      confirmPassword: "Abcdefg1" + "X".repeat(92),
    });
    expect(result.success).toBe(true);
  });
});

describe("forgotPasswordSchema 边界", () => {
  test("子域名邮箱通过", () => {
    expect(
      forgotPasswordSchema.safeParse({ email: "a@b.c.com" }).success,
    ).toBe(true);
  });

  test("邮箱含点号通过", () => {
    expect(
      forgotPasswordSchema.safeParse({ email: "a.b@c.com" }).success,
    ).toBe(true);
  });
});

describe("resetPasswordSchema 边界", () => {
  test("三轮输入都合法", () => {
    const result = resetPasswordSchema.safeParse({
      email: "user@domain.com",
      token: "000000",
      newPassword: "Password1",
    });
    expect(result.success).toBe(true);
  });

  test("token 全零通过（6位数字）", () => {
    const result = resetPasswordSchema.safeParse({
      email: "a@b.com",
      token: "000000",
      newPassword: "Abcdef12",
    });
    expect(result.success).toBe(true);
  });

  test("token 为空", () => {
    const result = resetPasswordSchema.safeParse({
      email: "a@b.com",
      token: "",
      newPassword: "Abcdef12",
    });
    expect(result.success).toBe(false);
  });

  test("邮箱为空", () => {
    const result = resetPasswordSchema.safeParse({
      email: "",
      token: "123456",
      newPassword: "Abcdef12",
    });
    expect(result.success).toBe(false);
  });
});

describe("emailSchema 边界", () => {
  test("大写邮箱通过", () => {
    expect(emailSchema.safeParse({ email: "A@B.COM" }).success).toBe(true);
  });

  test("邮件含加号通过", () => {
    expect(
      emailSchema.safeParse({ email: "test+tag@domain.com" }).success,
    ).toBe(true);
  });

  test("无域名部分", () => {
    expect(emailSchema.safeParse({ email: "user@" }).success).toBe(false);
  });
});
