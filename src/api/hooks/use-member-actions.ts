/** 加入/退出/成员列表 API hooks */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/api/client";

export interface ThreadMember {
  id: string;
  threadId: string;
  userId: string;
  role: string;
  playerMarked: boolean;
  joinedAt: string;
  user: {
    id: string;
    username: string;
    avatar: string | null;
  };
}

interface MembersResponse {
  code: number;
  message: string;
  data: ThreadMember[];
}

export function useThreadMembers(threadId: string | undefined) {
  return useQuery({
    queryKey: ["thread-members", threadId],
    queryFn: async () => {
      if (!threadId) return [];
      const { data, error } = await apiClient.GET(
        "/api/v1/threads/{threadId}/members",
        {
          params: { path: { threadId } },
        },
      );
      if (error) return [];
      return (data as unknown as MembersResponse)?.data ?? [];
    },
    enabled: !!threadId,
    staleTime: 10 * 1000,
  });
}

export function useMemberActions(threadId: string) {
  const queryClient = useQueryClient();

  const join = useMutation({
    mutationFn: async () => {
      const { error } = await apiClient.POST(
        "/api/v1/threads/{threadId}/members/join",
        {
          params: { path: { threadId } },
        },
      );
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["thread", threadId] });
      queryClient.invalidateQueries({ queryKey: ["thread-members", threadId] });
    },
  });

  const exit = useMutation({
    mutationFn: async () => {
      const { error } = await apiClient.DELETE(
        "/api/v1/threads/{threadId}/members/me",
        {
          params: { path: { threadId } },
        },
      );
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["thread", threadId] });
      queryClient.invalidateQueries({ queryKey: ["thread-members", threadId] });
    },
  });

  return { join, exit };
}
