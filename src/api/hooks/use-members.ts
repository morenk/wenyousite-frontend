/** 主题帖参与人列表 API hook */

import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/api/client";

export interface ThreadMember {
  id: string;
  threadId: string;
  userId: string;
  role: "OWNER" | "COLLABORATOR" | "PARTICIPANT";
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

export function useMembers(threadId: string | undefined) {
  return useQuery({
    queryKey: ["members", threadId],
    queryFn: async () => {
      if (!threadId) throw new Error("缺少主题帖 ID");
      const { data, error } = await apiClient.GET(
        "/api/v1/threads/{threadId}/members",
        { params: { path: { threadId } } },
      );
      if (error) throw error;
      return (data as unknown as MembersResponse).data;
    },
    enabled: !!threadId,
    staleTime: 5 * 1000,
  });
}
