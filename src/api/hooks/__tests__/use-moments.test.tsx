import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { queryKeys } from "@/api/query-keys";

const { mockGET, mockPOST, mockPATCH, mockDELETE } = vi.hoisted(() => ({
  mockGET: vi.fn(),
  mockPOST: vi.fn(),
  mockPATCH: vi.fn(),
  mockDELETE: vi.fn(),
}));

vi.mock("@/api/client", () => ({
  apiClient: {
    GET: mockGET,
    POST: mockPOST,
    PATCH: mockPATCH,
    DELETE: mockDELETE,
  },
}));

import {
  useCreateMoment,
  useCreateMomentComment,
  useDeleteMoment,
  useDeleteMomentComment,
  useMoment,
  useMomentBookmark,
  useMomentBookmarks,
  useMomentCommentAuthors,
  useMomentComments,
  useMomentLike,
  useMomentReplies,
  useMoments,
  useUpdateMoment,
  useUserMoments,
} from "@/api/hooks/use-moments";

const card = {
  id: "moment-1",
  authorId: "author-1",
  title: "动态标题",
  contentExcerpt: "正文",
  coverType: "TEXT" as const,
  coverMedia: null,
  textCoverTheme: "ROSE" as const,
  imageCount: 0,
  likeCount: 1,
  commentCount: 2,
  bookmarkCount: 3,
  tipTotal: "4",
  viewerLiked: false,
  viewerBookmarked: false,
};

function harness() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  }
  return { client, wrapper: Wrapper };
}

describe("moment hooks", () => {
  beforeEach(() => vi.clearAllMocks());

  test("发现流按 cursor 加载，未登录关注流保持禁用", async () => {
    mockGET
      .mockResolvedValueOnce({
        data: { data: [card], meta: { cursor: "next", hasMore: true } },
      })
      .mockResolvedValueOnce({
        data: { data: [{ ...card, id: "moment-2" }], meta: { cursor: null, hasMore: false } },
      });
    const { wrapper } = harness();
    const discover = renderHook(() => useMoments("DISCOVER", undefined), { wrapper });

    await waitFor(() => expect(discover.result.current.hasNextPage).toBe(true));
    await act(async () => { await discover.result.current.fetchNextPage(); });
    expect(mockGET).toHaveBeenNthCalledWith(2, "/api/v1/moments", {
      params: { query: { feed: "DISCOVER", limit: 20, cursor: "next" } },
    });

    mockGET.mockClear();
    const anonymous = harness();
    const following = renderHook(() => useMoments("FOLLOWING", undefined), {
      wrapper: anonymous.wrapper,
    });
    expect(following.result.current.fetchStatus).toBe("idle");
    expect(mockGET).not.toHaveBeenCalled();
  });

  test("详情读取与编辑调用生成契约并更新详情缓存", async () => {
    const detail = { ...card, content: "正文", images: [], version: 1, canEdit: true, canDelete: true };
    mockGET.mockResolvedValue({ data: { data: detail } });
    mockPATCH.mockResolvedValue({ data: { data: { ...detail, title: "新标题", version: 2 } } });
    const { client, wrapper } = harness();
    const query = renderHook(() => useMoment("moment-1", "user-1"), { wrapper });
    await waitFor(() => expect(query.result.current.data?.title).toBe("动态标题"));
    const update = renderHook(() => useUpdateMoment(), { wrapper });

    await act(async () => {
      await update.result.current.mutateAsync({
        id: "moment-1",
        body: { title: "新标题", content: "正文", version: 1 },
      });
    });

    expect(mockPATCH).toHaveBeenCalledWith("/api/v1/moments/{id}", {
      params: { path: { id: "moment-1" } },
      body: { title: "新标题", content: "正文", version: 1 },
    });
    expect(client.getQueryData<typeof detail>(queryKeys.moments.detail("moment-1", "user-1"))?.title).toBe("新标题");
  });

  test("发布使用幂等 body，并失效动态查询", async () => {
    mockPOST.mockResolvedValue({ data: { data: { ...card, content: "", images: [], version: 1 } } });
    const { client, wrapper } = harness();
    const listKey = queryKeys.moments.list("DISCOVER", "user-1");
    client.setQueryData(listKey, { pages: [] });
    const create = renderHook(() => useCreateMoment(), { wrapper });
    const body = {
      title: "动态标题",
      content: "",
      mediaIds: [],
      coverMediaId: null,
      clientRequestId: "00000000-0000-4000-8000-000000000001",
    };

    await act(async () => { await create.result.current.mutateAsync(body); });

    expect(mockPOST).toHaveBeenCalledWith("/api/v1/moments", { body });
    expect(client.getQueryState(listKey)?.isInvalidated).toBe(true);
  });

  test("点赞与收藏只修补当前卡片，不让发现流重排", async () => {
    mockPOST
      .mockResolvedValueOnce({ data: { data: { momentId: "moment-1", count: 2, active: true } } })
      .mockResolvedValueOnce({ data: { data: { momentId: "moment-1", count: 4, active: true } } });
    const { client, wrapper } = harness();
    const listKey = queryKeys.moments.list("DISCOVER", "user-1");
    client.setQueryData(listKey, { pages: [{ data: [card], meta: { cursor: null, hasMore: false } }] });
    const like = renderHook(() => useMomentLike("moment-1", false), { wrapper });
    const bookmark = renderHook(() => useMomentBookmark("moment-1", false), { wrapper });

    await act(async () => { await like.result.current.mutateAsync(); });
    await act(async () => { await bookmark.result.current.mutateAsync(); });

    const cached = client.getQueryData<{ pages: { data: typeof card[] }[] }>(listKey);
    expect(cached?.pages[0].data[0]).toMatchObject({
      likeCount: 2,
      viewerLiked: true,
      bookmarkCount: 4,
      viewerBookmarked: true,
    });
    expect(client.getQueryState(listKey)?.isInvalidated).toBe(false);
  });

  test("点赞在请求完成前乐观更新，失败时精确回滚", async () => {
    let rejectRequest: ((reason?: unknown) => void) | undefined;
    mockPOST.mockReturnValue(new Promise((_resolve, reject) => {
      rejectRequest = reject;
    }));
    const { client, wrapper } = harness();
    const listKey = queryKeys.moments.list("DISCOVER", "user-1");
    client.setQueryData(listKey, {
      pages: [{ data: [card], meta: { cursor: null, hasMore: false } }],
    });
    const like = renderHook(() => useMomentLike("moment-1", false), { wrapper });
    let mutation: Promise<unknown> | undefined;

    act(() => {
      mutation = like.result.current.mutateAsync().catch(() => undefined);
    });

    await waitFor(() => {
      const cached = client.getQueryData<{ pages: { data: typeof card[] }[] }>(listKey);
      expect(cached?.pages[0].data[0]).toMatchObject({
        likeCount: 2,
        viewerLiked: true,
      });
    });

    await act(async () => {
      rejectRequest?.(new Error("offline"));
      await mutation;
    });

    const rolledBack = client.getQueryData<{ pages: { data: typeof card[] }[] }>(listKey);
    expect(rolledBack?.pages[0].data[0]).toMatchObject({
      likeCount: 1,
      viewerLiked: false,
    });
  });

  test("用户动态与动态收藏复用游标分页并按登录态启用", async () => {
    mockGET.mockResolvedValue({ data: { data: [card], meta: { cursor: null, hasMore: false } } });
    const userHarness = harness();
    const userMoments = renderHook(() => useUserMoments("author-1", "viewer-1"), {
      wrapper: userHarness.wrapper,
    });
    await waitFor(() => expect(userMoments.result.current.data?.pages[0].data).toEqual([card]));
    expect(mockGET).toHaveBeenCalledWith("/api/v1/users/{id}/moments", {
      params: { path: { id: "author-1" }, query: { limit: 20 } },
    });

    mockGET.mockClear();
    const previewHarness = harness();
    const preview = renderHook(() => useUserMoments("author-1", "viewer-1", 2), {
      wrapper: previewHarness.wrapper,
    });
    await waitFor(() => expect(preview.result.current.data?.pages[0].data).toEqual([card]));
    expect(mockGET).toHaveBeenCalledWith("/api/v1/users/{id}/moments", {
      params: { path: { id: "author-1" }, query: { limit: 2 } },
    });
    expect(queryKeys.moments.user("author-1", "viewer-1", 2)).not.toEqual(
      queryKeys.moments.user("author-1", "viewer-1", 20),
    );

    mockGET.mockClear();
    const bookmarkHarness = harness();
    const bookmarks = renderHook(() => useMomentBookmarks(undefined), {
      wrapper: bookmarkHarness.wrapper,
    });
    expect(bookmarks.result.current.fetchStatus).toBe("idle");
    expect(mockGET).not.toHaveBeenCalled();
  });

  test("动态评论把顺序与回复者筛选带入分页，并读取可见作者候选", async () => {
    mockGET
      .mockResolvedValueOnce({
        data: { data: [], meta: { cursor: null, hasMore: false } },
      })
      .mockResolvedValueOnce({
        data: { data: [{ id: "author-1", username: "阿青", avatar: null, level: 1 }] },
      });
    const { wrapper } = harness();

    const comments = renderHook(
      () => useMomentComments("moment-1", "viewer-1", { order: "OLDEST", authorId: "author-1" }),
      { wrapper },
    );
    await waitFor(() => expect(comments.result.current.isSuccess).toBe(true));
    expect(mockGET).toHaveBeenNthCalledWith(1, "/api/v1/moments/{id}/comments", {
      params: {
        path: { id: "moment-1" },
        query: { limit: 20, order: "OLDEST", authorId: "author-1" },
      },
    });

    const authors = renderHook(
      () => useMomentCommentAuthors("moment-1", "viewer-1"),
      { wrapper },
    );
    await waitFor(() => expect(authors.result.current.data?.[0].username).toBe("阿青"));
    expect(mockGET).toHaveBeenNthCalledWith(2, "/api/v1/moments/{id}/comment-authors", {
      params: { path: { id: "moment-1" } },
    });
  });

  test("楼中楼只有展开后请求，并保持筛选条件与 cursor 一致", async () => {
    mockGET
      .mockResolvedValueOnce({
        data: { data: [{ id: "reply-1" }], meta: { cursor: "reply-next", hasMore: true } },
      })
      .mockResolvedValueOnce({
        data: { data: [{ id: "reply-2" }], meta: { cursor: null, hasMore: false } },
      });
    const disabledHarness = harness();
    const collapsed = renderHook(
      () => useMomentReplies("moment-1", "comment-1", "viewer-1", false),
      { wrapper: disabledHarness.wrapper },
    );
    expect(collapsed.result.current.fetchStatus).toBe("idle");
    expect(mockGET).not.toHaveBeenCalled();

    const expandedHarness = harness();
    const expanded = renderHook(
      () => useMomentReplies(
        "moment-1",
        "comment-1",
        "viewer-1",
        true,
        { order: "NEWEST", authorId: "author-1" },
      ),
      { wrapper: expandedHarness.wrapper },
    );
    await waitFor(() => expect(expanded.result.current.hasNextPage).toBe(true));
    await act(async () => { await expanded.result.current.fetchNextPage(); });

    expect(mockGET).toHaveBeenNthCalledWith(
      1,
      "/api/v1/moments/{id}/comments/{commentId}/replies",
      {
        params: {
          path: { id: "moment-1", commentId: "comment-1" },
          query: { limit: 20, order: "NEWEST", authorId: "author-1" },
        },
      },
    );
    expect(mockGET).toHaveBeenNthCalledWith(
      2,
      "/api/v1/moments/{id}/comments/{commentId}/replies",
      {
        params: {
          path: { id: "moment-1", commentId: "comment-1" },
          query: {
            limit: 20,
            order: "NEWEST",
            authorId: "author-1",
            cursor: "reply-next",
          },
        },
      },
    );
  });

  test("新增与删除评论刷新所有筛选列表，并同步修补动态评论数", async () => {
    mockPOST.mockResolvedValue({ data: { data: { id: "comment-new" } } });
    mockDELETE.mockResolvedValue({ data: { data: { message: "ok" } } });
    const { client, wrapper } = harness();
    const listKey = queryKeys.moments.list("DISCOVER", "viewer-1");
    const filteredCommentsKey = queryKeys.moments.comments(
      "moment-1",
      "viewer-1",
      { order: "OLDEST" },
    );
    client.setQueryData(listKey, {
      pages: [{ data: [card], meta: { cursor: null, hasMore: false } }],
    });
    client.setQueryData(filteredCommentsKey, {
      pages: [{ data: [], meta: { cursor: null, hasMore: false } }],
    });
    const create = renderHook(
      () => useCreateMomentComment("moment-1", "viewer-1"),
      { wrapper },
    );
    const remove = renderHook(
      () => useDeleteMomentComment("moment-1", "viewer-1"),
      { wrapper },
    );
    const body = {
      content: "评论正文",
      replyToCommentId: undefined,
      clientRequestId: "00000000-0000-4000-8000-000000000002",
    };

    await act(async () => { await create.result.current.mutateAsync(body); });
    expect(mockPOST).toHaveBeenCalledWith("/api/v1/moments/{id}/comments", {
      params: { path: { id: "moment-1" } },
      body,
    });
    expect(client.getQueryData<{ pages: { data: typeof card[] }[] }>(listKey)?.pages[0].data[0].commentCount).toBe(3);
    expect(client.getQueryState(filteredCommentsKey)?.isInvalidated).toBe(true);

    await act(async () => { await remove.result.current.mutateAsync("comment-new"); });
    expect(mockDELETE).toHaveBeenCalledWith(
      "/api/v1/moments/{id}/comments/{commentId}",
      { params: { path: { id: "moment-1", commentId: "comment-new" } } },
    );
    expect(client.getQueryData<{ pages: { data: typeof card[] }[] }>(listKey)?.pages[0].data[0].commentCount).toBe(2);
  });

  test("取消点赞与取消收藏使用 DELETE，并以服务端结果校准缓存", async () => {
    mockDELETE
      .mockResolvedValueOnce({ data: { data: { momentId: "moment-1", count: 0, active: false } } })
      .mockResolvedValueOnce({ data: { data: { momentId: "moment-1", count: 2, active: false } } });
    const { client, wrapper } = harness();
    const listKey = queryKeys.moments.list("DISCOVER", "viewer-1");
    client.setQueryData(listKey, {
      pages: [{
        data: [{ ...card, viewerLiked: true, likeCount: 1, viewerBookmarked: true }],
        meta: { cursor: null, hasMore: false },
      }],
    });
    const like = renderHook(() => useMomentLike("moment-1", true), { wrapper });
    const bookmark = renderHook(() => useMomentBookmark("moment-1", true), { wrapper });

    await act(async () => { await like.result.current.mutateAsync(); });
    await act(async () => { await bookmark.result.current.mutateAsync(); });

    expect(mockDELETE).toHaveBeenNthCalledWith(1, "/api/v1/moments/{id}/like", {
      params: { path: { id: "moment-1" } },
    });
    expect(mockDELETE).toHaveBeenNthCalledWith(2, "/api/v1/moments/{id}/bookmark", {
      params: { path: { id: "moment-1" } },
    });
    expect(client.getQueryData<{ pages: { data: typeof card[] }[] }>(listKey)?.pages[0].data[0]).toMatchObject({
      likeCount: 0,
      viewerLiked: false,
      bookmarkCount: 2,
      viewerBookmarked: false,
    });
  });

  test("删除动态失效全部动态缓存，未提供 id 的详情与作者列表不发请求", async () => {
    mockDELETE.mockResolvedValue({ data: { data: { message: "ok" } } });
    const { client, wrapper } = harness();
    const listKey = queryKeys.moments.list("DISCOVER", "viewer-1");
    client.setQueryData(listKey, { pages: [{ data: [card] }] });
    const remove = renderHook(() => useDeleteMoment(), { wrapper });

    await act(async () => { await remove.result.current.mutateAsync("moment-1"); });
    expect(mockDELETE).toHaveBeenCalledWith("/api/v1/moments/{id}", {
      params: { path: { id: "moment-1" } },
    });
    expect(client.getQueryState(listKey)?.isInvalidated).toBe(true);

    mockGET.mockClear();
    const disabledHarness = harness();
    const detail = renderHook(() => useMoment(undefined), { wrapper: disabledHarness.wrapper });
    const authors = renderHook(
      () => useMomentCommentAuthors(undefined),
      { wrapper: disabledHarness.wrapper },
    );
    expect(detail.result.current.fetchStatus).toBe("idle");
    expect(authors.result.current.fetchStatus).toBe("idle");
    expect(mockGET).not.toHaveBeenCalled();
  });

  test("用户动态与收藏都原样传递下一页 cursor", async () => {
    mockGET
      .mockResolvedValueOnce({ data: { data: [card], meta: { cursor: "user-next", hasMore: true } } })
      .mockResolvedValueOnce({ data: { data: [], meta: { cursor: null, hasMore: false } } })
      .mockResolvedValueOnce({ data: { data: [card], meta: { cursor: "bookmark-next", hasMore: true } } })
      .mockResolvedValueOnce({ data: { data: [], meta: { cursor: null, hasMore: false } } });
    const userHarness = harness();
    const userMoments = renderHook(
      () => useUserMoments("author-1", "viewer-1"),
      { wrapper: userHarness.wrapper },
    );
    await waitFor(() => expect(userMoments.result.current.hasNextPage).toBe(true));
    await act(async () => { await userMoments.result.current.fetchNextPage(); });

    const bookmarkHarness = harness();
    const bookmarks = renderHook(
      () => useMomentBookmarks("viewer-1"),
      { wrapper: bookmarkHarness.wrapper },
    );
    await waitFor(() => expect(bookmarks.result.current.hasNextPage).toBe(true));
    await act(async () => { await bookmarks.result.current.fetchNextPage(); });

    expect(mockGET).toHaveBeenNthCalledWith(2, "/api/v1/users/{id}/moments", {
      params: { path: { id: "author-1" }, query: { limit: 20, cursor: "user-next" } },
    });
    expect(mockGET).toHaveBeenNthCalledWith(4, "/api/v1/moments/bookmarks", {
      params: { query: { limit: 20, cursor: "bookmark-next" } },
    });
  });

  test("成功响应缺少可选 envelope 时，各列表安全降级为空页", async () => {
    mockGET.mockResolvedValue({ data: undefined });
    const feedHarness = harness();
    const feed = renderHook(
      () => useMoments("DISCOVER"),
      { wrapper: feedHarness.wrapper },
    );
    await waitFor(() => expect(feed.result.current.isSuccess).toBe(true));
    expect(feed.result.current.data?.pages[0]).toMatchObject({
      data: [],
      meta: { cursor: null, hasMore: false },
    });

    const commentsHarness = harness();
    const comments = renderHook(
      () => useMomentComments("moment-1"),
      { wrapper: commentsHarness.wrapper },
    );
    await waitFor(() => expect(comments.result.current.isSuccess).toBe(true));
    expect(comments.result.current.data?.pages[0].data).toEqual([]);

    const repliesHarness = harness();
    const replies = renderHook(
      () => useMomentReplies("moment-1", "comment-1", undefined, true),
      { wrapper: repliesHarness.wrapper },
    );
    await waitFor(() => expect(replies.result.current.isSuccess).toBe(true));
    expect(replies.result.current.data?.pages[0].data).toEqual([]);

    const authorsHarness = harness();
    const authors = renderHook(
      () => useMomentCommentAuthors("moment-1"),
      { wrapper: authorsHarness.wrapper },
    );
    await waitFor(() => expect(authors.result.current.isSuccess).toBe(true));
    expect(authors.result.current.data).toEqual([]);

    const userHarness = harness();
    const userMoments = renderHook(
      () => useUserMoments("author-1"),
      { wrapper: userHarness.wrapper },
    );
    await waitFor(() => expect(userMoments.result.current.isSuccess).toBe(true));
    expect(userMoments.result.current.data?.pages[0].data).toEqual([]);

    const bookmarksHarness = harness();
    const bookmarks = renderHook(
      () => useMomentBookmarks("viewer-1"),
      { wrapper: bookmarksHarness.wrapper },
    );
    await waitFor(() => expect(bookmarks.result.current.isSuccess).toBe(true));
    expect(bookmarks.result.current.data?.pages[0].data).toEqual([]);
  });

  test("API error envelope 与关键写接口空响应都进入错误态", async () => {
    const apiError = { code: 50301, message: "暂时不可用" };
    mockGET.mockResolvedValueOnce({ error: apiError });
    const detailHarness = harness();
    const detail = renderHook(
      () => useMoment("moment-1"),
      { wrapper: detailHarness.wrapper },
    );
    await waitFor(() => expect(detail.result.current.isError).toBe(true));
    expect(detail.result.current.error).toBe(apiError);

    mockPOST.mockResolvedValueOnce({ data: undefined });
    const createHarness = harness();
    const create = renderHook(() => useCreateMoment(), { wrapper: createHarness.wrapper });
    await act(async () => {
      await expect(create.result.current.mutateAsync({
        title: "动态标题",
        content: "",
        mediaIds: [],
        coverMediaId: null,
        clientRequestId: "00000000-0000-4000-8000-000000000003",
      })).rejects.toThrow("发布动态失败");
    });

    mockPOST.mockResolvedValueOnce({ data: undefined });
    const commentHarness = harness();
    const comment = renderHook(
      () => useCreateMomentComment("moment-1"),
      { wrapper: commentHarness.wrapper },
    );
    await act(async () => {
      await expect(comment.result.current.mutateAsync({
        content: "评论",
        clientRequestId: "00000000-0000-4000-8000-000000000004",
      })).rejects.toThrow("评论失败");
    });
  });
});
