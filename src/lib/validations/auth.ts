/** 认证模块共享 Zod 校验 schema */

import { z } from "zod";

export const emailSchema = z.object({
  email: z
    .string()
    .min(1, { message: "请输入邮箱" })
    .email({ message: "邮箱格式不正确" }),
});

export const loginSchema = z.object({
  email: z
    .string()
    .min(1, { message: "请输入邮箱" })
    .email({ message: "邮箱格式不正确" }),
  password: z
    .string()
    .min(1, { message: "请输入密码" })
    .min(8, { message: "密码至少 8 位" }),
});

export const registerStep2Schema = z.object({
  code: z
    .string()
    .min(6, { message: "验证码为 6 位数字" })
    .max(6, { message: "验证码为 6 位数字" })
    .regex(/^\d+$/, { message: "验证码为 6 位数字" }),
  username: z
    .string()
    .min(2, { message: "用户名至少 2 位" })
    .max(24, { message: "用户名最多 24 位" })
    .regex(/^[\w\u4e00-\u9fff]+$/, {
      message: "用户名只允许字母、数字、中文",
    }),
  password: z
    .string()
    .min(8, { message: "密码至少 8 位" })
    .regex(/[a-zA-Z]/, { message: "密码需包含至少一个字母" })
    .regex(/\d/, { message: "密码需包含至少一个数字" }),
});

export const forgotPasswordSchema = z.object({
  email: z
    .string()
    .min(1, { message: "请输入邮箱" })
    .email({ message: "邮箱格式不正确" }),
});

export const resetPasswordSchema = z.object({
  email: z
    .string()
    .min(1, { message: "请输入邮箱" })
    .email({ message: "邮箱格式不正确" }),
  token: z
    .string()
    .min(6, { message: "验证码为 6 位数字" })
    .max(6, { message: "验证码为 6 位数字" })
    .regex(/^\d+$/, { message: "验证码为 6 位数字" }),
  newPassword: z
    .string()
    .min(8, { message: "密码至少 8 位" })
    .regex(/[a-zA-Z]/, { message: "密码需包含至少一个字母" })
    .regex(/\d/, { message: "密码需包含至少一个数字" }),
});

export const verifyEmailSchema = z.object({
  token: z
    .string()
    .min(6, { message: "验证码为 6 位数字" })
    .max(6, { message: "验证码为 6 位数字" })
    .regex(/^\d+$/, { message: "验证码为 6 位数字" }),
});

export const changePasswordSchema = z
  .object({
    oldPassword: z.string().min(1, { message: "请输入当前密码" }),
    newPassword: z
      .string()
      .min(8, { message: "密码至少 8 位" })
      .regex(/[a-zA-Z]/, { message: "密码需包含至少一个字母" })
      .regex(/\d/, { message: "密码需包含至少一个数字" }),
    confirmPassword: z.string().min(1, { message: "请再次输入新密码" }),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "两次输入的新密码不一致",
    path: ["confirmPassword"],
  });

export const changeEmailSchema = z.object({
  oldPassword: z.string().min(1, { message: "请输入当前密码" }),
  newEmail: z
    .string()
    .min(1, { message: "请输入新邮箱" })
    .email({ message: "邮箱格式不正确" }),
  code: z
    .string()
    .min(6, { message: "验证码为 6 位数字" })
    .max(6, { message: "验证码为 6 位数字" })
    .regex(/^\d+$/, { message: "验证码为 6 位数字" }),
});

export type LoginFormData = z.infer<typeof loginSchema>;
export type RegisterStep2FormData = z.infer<typeof registerStep2Schema>;
export type ForgotPasswordFormData = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordFormData = z.infer<typeof resetPasswordSchema>;
export type VerifyEmailFormData = z.infer<typeof verifyEmailSchema>;
export type ChangePasswordFormData = z.infer<typeof changePasswordSchema>;
export type ChangeEmailFormData = z.infer<typeof changeEmailSchema>;
