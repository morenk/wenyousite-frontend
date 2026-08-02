/** 注册 API hooks */

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/api/client";

interface RequestCodeResponse {
  code: number;
  message: string;
  data: {
    emailSent: boolean;
    codeExpiresIn: number;
    message?: string;
  };
}

export function useSendRegisterCode() {
  return useMutation({
    mutationFn: async (email: string) => {
      const { data, error } = await apiClient.POST(
        "/api/v1/auth/register/request-code",
        { body: { email } },
      );
      if (error) throw error;
      return data as unknown as RequestCodeResponse;
    },
  });
}

interface RegisterCompleteRequest {
  email: string;
  code: string;
  username: string;
  password: string;
}

interface RegisterResponse {
  code: number;
  message?: string;
  data: {
    accessToken: string;
    refreshToken: string;
    user: {
      id: string;
      email: string;
      username: string;
      avatar: string | null;
      role: string;
      emailVerified: boolean;
    };
  };
}

export function useRegisterComplete() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (req: RegisterCompleteRequest) => {
      const { data, error } = await apiClient.POST(
        "/api/v1/auth/register/verify-and-complete",
        { body: req },
      );
      if (error) throw error;
      return data as unknown as RegisterResponse;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });
}
