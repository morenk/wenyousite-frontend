/** normalizeThreadDetail 工具函数测试 */

import { describe, test, expect } from "vitest";
import { normalizeThreadDetail } from "@/api/hooks/use-thread-detail";
import type {
  RawThreadDetail,
  SubthreadDetail,
} from "@/api/hooks/use-thread-detail";

function makeSub(id: string): SubthreadDetail {
  return {
    id,
    threadId: "thread-1",
    title: "子贴" + id,
    sortOrder: 0,
    postingPolicy: "PARTICIPANTS",
    version: 1,
    lastPostAt: null,
    deletedAt: null,
    createdAt: "2026-01-01T00:00:00Z",
    bodyPost: null,
    _count: { posts: 0 },
  };
}

const raw: RawThreadDetail = {
  id: "thread-1",
  title: "测试帖",
  ownerId: "user-1",
  category: "RPG",
  status: "RECRUITING",
  visibility: "PUBLIC",
  published: true,
  publishedAt: "2026-01-01T00:00:00Z",
  pinned: false,
  pinnedAt: null,
  viewCount: 0,
  version: 1,
  likeCount: 0,
  defaultSubthreadId: "sub-2",
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-01T00:00:00Z",
  deletedAt: null,
  owner: { id: "user-1", username: "test", avatar: null },
  subthreads: [makeSub("sub-1"), makeSub("sub-2"), makeSub("sub-3")],
  topicTags: [],
  _count: { members: 1, players: 1, posts: 3 },
};

describe("normalizeThreadDetail", () => {
  test("匹配 defaultSubthreadId", () => {
    const result = normalizeThreadDetail(raw);
    expect(result.defaultSubthread.id).toBe("sub-2");
  });

  test("defaultSubthreadId 无匹配时拒绝不完整响应", () => {
    const r = { ...raw, defaultSubthreadId: "nonexistent" };
    expect(() => normalizeThreadDetail(r)).toThrow("未返回可用子贴");
  });

  test("defaultSubthread 基于 id 精确匹配", () => {
    const result = normalizeThreadDetail(raw);
    expect(result.defaultSubthread.title).toBe("子贴sub-2");
  });

  test("subthreads 为空时拒绝不完整响应", () => {
    const r = { ...raw, subthreads: [] };
    expect(() => normalizeThreadDetail(r)).toThrow("未返回可用子贴");
  });
});
