/** 主题帖访问操作 hooks：邀请链接与退出玩家身份 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/api/client";
import { queryKeys } from "@/api/query-keys";
import type { components } from "@/api/types";

export type InvitePreview = components["schemas"]["InvitePreviewResponseDto"];

export function useCreateInviteLink() {
  return useMutation({
    mutationFn: async (threadId: string) => {
      const { data, error } = await apiClient.POST("/api/v1/threads/{id}/invite-link", {
        params: { path: { id: threadId } },
      });
      if (error) throw error;
      if (!data) throw new Error("邀请链接响应为空");
      return data.data;
    },
  });
}

export function useInvitePreview(token: string | undefined) {
  return useQuery({
    queryKey: queryKeys.invitePreview(token),
    queryFn: async () => {
      if (!token) throw new Error("缺少邀请 token");
      const { data, error } = await apiClient.GET("/api/v1/threads/join-by-link/{token}", {
        params: { path: { token } },
      });
      if (error) throw error;
      if (!data) throw new Error("邀请预览响应为空");
      return data.data;
    },
    enabled: !!token,
    // 邀请 token 的 404/403 是确定结果；重试只会让失效页多转数秒并重复刷请求。
    retry: false,
  });
}

export function useJoinThreadByInvite() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (token: string) => {
      const { data, error } = await apiClient.POST("/api/v1/threads/join-by-link/{token}", {
        params: { path: { token } },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.users.playedThreads() });
    },
  });
}

export function useExitThreadPlayer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (threadId: string) => {
      const { data, error } = await apiClient.DELETE("/api/v1/threads/{threadId}/members/me", {
        params: { path: { threadId } },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (_data, threadId) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.members.list(threadId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.threads.detail(threadId) });
    },
  });
}
