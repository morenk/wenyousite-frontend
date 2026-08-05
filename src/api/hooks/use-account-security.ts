/** 账号安全 API hooks：设备会话、黑名单和账号注销 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/api/client";

export interface AccountSession {
  id: string;
  platform: string;
  deviceInfo: string | null;
  isCurrent: boolean;
  createdAt: string;
  expiresAt: string;
}

export interface BlockedUserRecord {
  id: string;
  blocked: {
    id: string;
    username: string;
    avatar: string | null;
  };
}

interface Envelope<T> {
  data: T;
}

interface ApiError {
  code?: number;
  message?: string;
}

const RATE_LIMIT_ERROR_CODE = 42900;

export function isRateLimitedAccountSessionError(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    (error as ApiError).code === RATE_LIMIT_ERROR_CODE
  );
}

export function shouldRetryAccountSessions(failureCount: number, error: unknown) {
  return !isRateLimitedAccountSessionError(error) && failureCount < 3;
}

export function useAccountSessions() {
  return useQuery({
    queryKey: ["auth-sessions"],
    queryFn: async () => {
      const { data, error } = await apiClient.GET("/api/v1/auth/sessions");
      if (error) throw error;
      return (data as unknown as Envelope<AccountSession[]>).data;
    },
    retry: shouldRetryAccountSessions,
  });
}

export function useRevokeSession() {
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
      queryClient.setQueryData<AccountSession[]>(["auth-sessions"], (sessions) =>
        sessions?.filter((session) => session.id !== sessionId),
      );
    },
  });
}

export function useBlockedUsers() {
  return useQuery({
    queryKey: ["blocked-users"],
    queryFn: async () => {
      const { data, error } = await apiClient.GET("/api/v1/users/me/blocks");
      if (error) throw error;
      return (data as unknown as Envelope<BlockedUserRecord[]>).data;
    },
  });
}

export function useUnblockUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (userId: string) => {
      const { data, error } = await apiClient.DELETE("/api/v1/users/me/block/{id}", {
        params: { path: { id: userId } },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["blocked-users"] }),
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
