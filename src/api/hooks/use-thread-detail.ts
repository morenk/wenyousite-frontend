/** 获取主题帖详情 API hook */

import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/api/client";

export interface ThreadTag {
  id: string;
  name: string;
  color: string | null;
}

export interface ThreadOwner {
  id: string;
  username: string;
  avatar: string | null;
}

export interface SubthreadDetail {
  id: string;
  threadId: string;
  title: string;
  sortOrder: number;
  postingPolicy: "PARTICIPANTS" | "COLLABORATORS" | "PLAYERS";
  version: number;
  lastPostAt: string | null;
  deletedAt: string | null;
  createdAt: string;
  bodyPost: {
    id: string;
    content: string;
    version: number;
  } | null;
  _count: { posts: number };
  tags: { tag: { id: string; name: string; color: string | null } }[];
}

export interface ThreadDetail {
  id: string;
  title: string;
  ownerId: string;
  category: "DEDUCTION" | "NATION" | "RPG";
  status: "RECRUITING" | "CLOSED" | "FINISHED";
  visibility: "PUBLIC" | "PRIVATE";
  published: boolean;
  publishedAt: string | null;
  pinned: boolean;
  pinnedAt: string | null;
  viewCount: number;
  version: number;
  likeCount: number;
  defaultSubthreadId: string;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  owner: ThreadOwner;
  subthreads: SubthreadDetail[];
  defaultSubthread: SubthreadDetail;
  topicTags: { tag: ThreadTag }[];
  _count: {
    members: number;
    players: number;
    posts: number;
  };
}

export interface RawThreadDetail {
  id: string;
  title: string;
  ownerId: string;
  category: "DEDUCTION" | "NATION" | "RPG";
  status: "RECRUITING" | "CLOSED" | "FINISHED";
  visibility: "PUBLIC" | "PRIVATE";
  published: boolean;
  publishedAt: string | null;
  pinned: boolean;
  pinnedAt: string | null;
  viewCount: number;
  version: number;
  likeCount: number;
  defaultSubthreadId: string;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  owner: ThreadOwner;
  subthreads: SubthreadDetail[];
  topicTags: { tag: ThreadTag }[];
  _count: {
    members: number;
    players: number;
    posts: number;
  };
}

interface ThreadDetailResponse {
  code: number;
  message: string;
  data: RawThreadDetail;
}

export function normalizeThreadDetail(raw: RawThreadDetail): ThreadDetail {
  const defaultSubthread =
    raw.subthreads?.find((s) => s.id === raw.defaultSubthreadId) ??
    raw.subthreads?.[0];

  return {
    ...raw,
    defaultSubthread: defaultSubthread!,
  };
}

export function useThreadDetail(threadId: string | undefined) {
  return useQuery({
    queryKey: ["thread", threadId],
    queryFn: async () => {
      if (!threadId) throw new Error("缺少主题帖 ID");
      const { data, error } = await apiClient.GET("/api/v1/threads/{id}", {
        params: { path: { id: threadId } },
      });
      if (error) throw error;
      return normalizeThreadDetail((data as unknown as ThreadDetailResponse).data);
    },
    enabled: !!threadId,
    staleTime: 5 * 1000,
  });
}
