/** 登录 API hook */

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/api/client";

interface LoginRequest {
  account: string;
  password: string;
}

interface LoginResponse {
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

export function useLogin() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (req: LoginRequest) => {
      const { data, error } = await apiClient.POST("/api/v1/auth/login", {
        body: req,
      });
      if (error) throw error;
      return data as unknown as LoginResponse;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });
}
