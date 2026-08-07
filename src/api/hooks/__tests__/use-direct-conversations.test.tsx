import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";
import {
  useDirectConversation,
  useDirectConversationLookup,
  useDirectConversations,
  useDirectUnreadCount,
} from "@/api/hooks/use-direct-conversations";

const { mockGET } = vi.hoisted(() => ({ mockGET: vi.fn() }));

vi.mock("@/api/client", () => ({ apiClient: { GET: mockGET } }));

function wrapper() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };
}

describe("useDirectUnreadCount", () => {
  test("返回未读消息和待处理请求的合计", async () => {
    mockGET.mockResolvedValue({
      data: {
        data: { unreadMessageCount: 3, pendingRequestCount: 2, total: 5 },
      },
      error: undefined,
    });
    const { result } = renderHook(() => useDirectUnreadCount("u1"), { wrapper: wrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockGET).toHaveBeenCalledWith("/api/v1/direct-conversations/unread");
    expect(result.current.data?.total).toBe(5);
  });

  test("未登录时不查询", () => {
    mockGET.mockClear();
    renderHook(() => useDirectUnreadCount(undefined), { wrapper: wrapper() });
    expect(mockGET).not.toHaveBeenCalled();
  });
});

describe("direct conversation queries", () => {
  test("会话列表按 cursor 加载下一页", async () => {
    mockGET.mockImplementation(async (_path: string, options: { params: { query: { cursor?: string } } }) => {
      const cursor = options.params.query.cursor;
      return cursor
        ? { data: { data: [{ id: "c2" }], meta: { cursor: null, hasMore: false } } }
        : { data: { data: [{ id: "c1" }], meta: { cursor: "c1", hasMore: true } } };
    });
    const { result } = renderHook(() => useDirectConversations("INBOX", "u1"), {
      wrapper: wrapper(),
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.hasNextPage).toBe(true);
    await act(async () => {
      await result.current.fetchNextPage();
    });
    await waitFor(() => expect(result.current.data?.pages.flatMap((page) => page.data)).toEqual([
      { id: "c1" },
      { id: "c2" },
    ]));
  });

  test("会话列表处理 API 错误与空响应", async () => {
    mockGET.mockResolvedValueOnce({ error: { message: "failed" } });
    const failed = renderHook(() => useDirectConversations("REQUESTS", "u1"), {
      wrapper: wrapper(),
    });
    await waitFor(() => expect(failed.result.current.isError).toBe(true));

    mockGET.mockResolvedValueOnce({ data: undefined, error: undefined });
    const empty = renderHook(() => useDirectConversations("ARCHIVED", "u2"), {
      wrapper: wrapper(),
    });
    await waitFor(() => expect(empty.result.current.isError).toBe(true));
    expect(empty.result.current.error).toEqual(new Error("会话列表响应为空"));
  });

  test("查询单条会话和指定用户联系状态", async () => {
    mockGET
      .mockResolvedValueOnce({ data: { data: { id: "c1" } }, error: undefined })
      .mockResolvedValueOnce({
        data: { data: { contactState: "NEW", canInitiate: true, conversation: null } },
        error: undefined,
      });
    const detail = renderHook(() => useDirectConversation("c1", "u1"), { wrapper: wrapper() });
    const lookup = renderHook(() => useDirectConversationLookup("u2", "u1"), { wrapper: wrapper() });
    await waitFor(() => expect(detail.result.current.isSuccess).toBe(true));
    await waitFor(() => expect(lookup.result.current.isSuccess).toBe(true));
    expect(detail.result.current.data).toEqual({ id: "c1" });
    expect(lookup.result.current.data?.canInitiate).toBe(true);
  });

  test("详情和联系状态空响应会报错，缺少 ID 时不查询", async () => {
    mockGET.mockResolvedValue({ data: undefined, error: undefined });
    const detail = renderHook(() => useDirectConversation("c1", "u1"), { wrapper: wrapper() });
    const lookup = renderHook(() => useDirectConversationLookup("u2", "u1"), { wrapper: wrapper() });
    await waitFor(() => expect(detail.result.current.isError).toBe(true));
    await waitFor(() => expect(lookup.result.current.isError).toBe(true));

    mockGET.mockClear();
    renderHook(() => useDirectConversation(undefined, "u1"), { wrapper: wrapper() });
    renderHook(() => useDirectConversationLookup(undefined, "u1"), { wrapper: wrapper() });
    expect(mockGET).not.toHaveBeenCalled();
  });
});
