/** 认证操作 API hooks（忘记密码、重置密码、邮箱验证、登出等） */

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/api/client";
import { queryKeys } from "@/api/query-keys";

interface ForgotPasswordRequest {
  email: string;
}

export function useForgotPassword() {
  return useMutation({
    mutationFn: async (req: ForgotPasswordRequest) => {
      const { data, error } = await apiClient.POST("/api/v1/auth/forgot-password", {
        body: req,
      });
      if (error) throw error;
      return data;
    },
  });
}

interface ResetPasswordRequest {
  email: string;
  token: string;
  newPassword: string;
}

export function useResetPassword() {
  return useMutation({
    mutationFn: async (req: ResetPasswordRequest) => {
      const { data, error } = await apiClient.POST("/api/v1/auth/reset-password", {
        body: req,
      });
      if (error) throw error;
      return data;
    },
  });
}

export function useVerifyEmail() {
  return useMutation({
    mutationFn: async (token: string) => {
      const { data, error } = await apiClient.POST("/api/v1/auth/verify-email", {
        body: { token },
      });
      if (error) throw error;
      return data;
    },
  });
}

export function useResendVerification() {
  return useMutation({
    mutationFn: async (email: string) => {
      const { data, error } = await apiClient.POST(
        "/api/v1/auth/resend-verification",
        { body: { email } },
      );
      if (error) throw error;
      return data;
    },
  });
}

interface ChangePasswordRequest {
  oldPassword: string;
  newPassword: string;
}

/** 修改密码：成功后后端吊销全部 refresh token，需重新登录 */
export function useChangePassword() {
  return useMutation({
    mutationFn: async (req: ChangePasswordRequest) => {
      const { data, error } = await apiClient.POST("/api/v1/auth/change-password", {
        body: req,
      });
      if (error) throw error;
      return data;
    },
  });
}

interface ChangeEmailRequest {
  newEmail: string;
  oldPassword: string;
}

/** 更换邮箱第一步：校验当前密码后向新邮箱发送验证码 */
export function useChangeEmailRequest() {
  return useMutation({
    mutationFn: async (req: ChangeEmailRequest) => {
      const { data, error } = await apiClient.POST(
        "/api/v1/auth/change-email/request-code",
        { body: req },
      );
      if (error) throw error;
      return data;
    },
  });
}

interface ChangeEmailVerifyRequest {
  newEmail: string;
  code: string;
}

/** 更换邮箱第二步：验证码确认并更新邮箱 */
export function useChangeEmailVerify() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (req: ChangeEmailVerifyRequest) => {
      const { data, error } = await apiClient.POST(
        "/api/v1/auth/change-email/verify",
        { body: req },
      );
      if (error) throw error;
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.me }),
  });
}

/** 服务端吊销当前 Web refresh 会话；本地认证状态由调用方在成功后清理。 */
export function useLogout() {
  return useMutation({
    mutationFn: async () => {
      const { data, error } = await apiClient.POST("/api/v1/auth/logout", {
        body: {},
      });
      if (error) throw error;
      return data;
    },
  });
}
