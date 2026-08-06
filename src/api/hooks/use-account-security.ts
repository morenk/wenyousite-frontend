/** 账号安全 API hooks：登录终端、黑名单和账号注销 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/api/client";
import { queryKeys } from "@/api/query-keys";
import type { components } from "@/api/types";
import { hasApiErrorCode } from "@/api/errors";

export type AccountSession = components["schemas"]["SessionResponseDto"];
export type BlockedUserRecord =
  components["schemas"]["BlockedUserRecordResponseDto"];

const RATE_LIMIT_ERROR_CODE = 42900;

export function isRateLimitedAccountSessionError(error: unknown) {
  return hasApiErrorCode(error, RATE_LIMIT_ERROR_CODE);
}

export function shouldRetryAccountSessions(failureCount: number, error: unknown) {
  return !isRateLimitedAccountSessionError(error) && failureCount < 3;
}

export const accountSessionsQueryKey = queryKeys.sessions;
export const blockedUsersQueryKey = queryKeys.blockedUsers;

export function useAccountSessions(userId?: string) {
  return useQuery({
    queryKey: accountSessionsQueryKey(userId),
    queryFn: async () => {
      if (!userId) throw new Error("缺少用户 ID");
      const { data, error } = await apiClient.GET("/api/v1/auth/sessions");
      if (error) throw error;
      return data?.data ?? [];
    },
    enabled: Boolean(userId),
    retry: shouldRetryAccountSessions,
    staleTime: 0,
    refetchOnMount: "always",
  });
}

export function useRevokeSession(userId?: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (sessionId: string) => {
      const { data, error } = await apiClient.DELETE("/api/v1/auth/sessions/{id}", {
        params: { path: { id: sessionId } },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (_data, sessionId) => {
      queryClient.setQueryData<AccountSession[]>(accountSessionsQueryKey(userId), (sessions) =>
        sessions?.filter((session) => session.id !== sessionId),
      );
    },
  });
}

export function useBlockedUsers(userId?: string) {
  return useQuery({
    queryKey: blockedUsersQueryKey(userId),
    queryFn: async () => {
      if (!userId) throw new Error("缺少用户 ID");
      const { data, error } = await apiClient.GET("/api/v1/users/me/blocks");
      if (error) throw error;
      if (!data) throw new Error("黑名单响应为空");
      return data.data;
    },
    enabled: Boolean(userId),
  });
}

export function useUnblockUser(userId?: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (userId: string) => {
      const { data, error } = await apiClient.DELETE("/api/v1/users/me/block/{id}", {
        params: { path: { id: userId } },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: blockedUsersQueryKey(userId) }),
  });
}

export function useDeleteAccount() {
  return useMutation({
    mutationFn: async () => {
      const { data, error } = await apiClient.DELETE("/api/v1/users/me");
      if (error) throw error;
      return data;
    },
  });
}
