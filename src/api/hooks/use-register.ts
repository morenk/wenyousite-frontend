/** 注册 API hooks */

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/api/client";
import { queryKeys } from "@/api/query-keys";
import type { components } from "@/api/types";

export function useSendRegisterCode() {
  return useMutation({
    mutationFn: async (email: string) => {
      const { data, error } = await apiClient.POST(
        "/api/v1/auth/register/request-code",
        { body: { email } },
      );
      if (error) throw error;
      if (!data) throw new Error("验证码响应为空");
      return data;
    },
  });
}

type RegisterCompleteRequest = components["schemas"]["VerifyAndCompleteDto"];

export function useRegisterComplete() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (req: RegisterCompleteRequest) => {
      const { data, error } = await apiClient.POST(
        "/api/v1/auth/register/verify-and-complete",
        { body: req },
      );
      if (error) throw error;
      if (!data) throw new Error("注册响应为空");
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.notifications.all });
    },
  });
}
