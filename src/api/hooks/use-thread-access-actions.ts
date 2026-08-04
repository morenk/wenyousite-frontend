/** 主题帖访问操作 hooks：邀请链接、公开加入与退出玩家身份 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/api/client";

interface Envelope<T> { data: T }

export interface InvitePreview {
  thread: {
    id: string;
    title: string;
    category: "DEDUCTION" | "NATION" | "RPG";
    status: "RECRUITING" | "CLOSED" | "FINISHED";
    owner: { id: string; username: string; avatar: string | null };
    memberCount: number;
    createdAt: string;
  };
}

export function useCreateInviteLink() {
  return useMutation({
    mutationFn: async (threadId: string) => {
      const { data, error } = await apiClient.POST("/api/v1/threads/{id}/invite-link", {
        params: { path: { id: threadId } },
      });
      if (error) throw error;
      return (data as unknown as Envelope<{ threadId: string; token: string }>).data;
    },
  });
}

export function useInvitePreview(token: string | undefined) {
  return useQuery({
    queryKey: ["invite-preview", token],
    queryFn: async () => {
      if (!token) throw new Error("缺少邀请 token");
      const { data, error } = await apiClient.GET("/api/v1/threads/join-by-link/{token}", {
        params: { path: { token } },
      });
      if (error) throw error;
      return (data as unknown as Envelope<InvitePreview>).data;
    },
    enabled: !!token,
  });
}

export function useJoinThreadByInvite() {
  return useMutation({
    mutationFn: async (token: string) => {
      const { data, error } = await apiClient.POST("/api/v1/threads/join-by-link/{token}", {
        params: { path: { token } },
      });
      if (error) throw error;
      return data;
    },
  });
}

export function useJoinPublicThread() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (threadId: string) => {
      const { data, error } = await apiClient.POST("/api/v1/threads/{threadId}/members/join", {
        params: { path: { threadId } },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (_data, threadId) => {
      queryClient.invalidateQueries({ queryKey: ["members", threadId] });
      queryClient.invalidateQueries({ queryKey: ["thread", threadId] });
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
      queryClient.invalidateQueries({ queryKey: ["members", threadId] });
      queryClient.invalidateQueries({ queryKey: ["thread", threadId] });
    },
  });
}
