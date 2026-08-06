/** 登录 API hook */

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/api/client";
import { queryKeys } from "@/api/query-keys";
import type { components } from "@/api/types";

type LoginRequest = components["schemas"]["LoginDto"];

export function useLogin() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (req: LoginRequest) => {
      const { data, error } = await apiClient.POST("/api/v1/auth/login", {
        body: req,
      });
      if (error) throw error;
      if (!data) throw new Error("登录响应为空");
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.notifications.all });
    },
  });
}
