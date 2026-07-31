/** 认证操作 API hooks（忘记密码、重置密码、邮箱验证、登出等） */

import { useMutation } from "@tanstack/react-query";
import { apiClient } from "@/api/client";

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
