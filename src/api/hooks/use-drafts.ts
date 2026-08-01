/** 我的草稿列表 API hook（GET /threads/draft，未发布帖） */

import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/api/client";
import type { ThreadTag } from "./use-threads";

export interface DraftThread {
  id: string;
  title: string;
  category: string;
  status: string;
  visibility: "PUBLIC" | "PRIVATE";
  published: boolean;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  defaultSubthreadId: string | null;
  defaultSubthread: { id: string; title: string } | null;
  topicTags: { tag: ThreadTag }[];
  _count: { subthreads: number; posts: number };
}

interface DraftsResponse {
  code: number;
  message: string;
  data: DraftThread[];
}

export function useDrafts() {
  return useQuery({
    queryKey: ["drafts"],
    queryFn: async () => {
      const { data, error } = await apiClient.GET("/api/v1/threads/draft");
      if (error) throw error;
      const response = data as unknown as DraftsResponse;
      return response?.data ?? [];
    },
    staleTime: 10 * 1000,
  });
}
