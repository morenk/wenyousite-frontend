import React from "react";
import { QueryClient, QueryClientProvider, type InfiniteData } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";
import {
  appendDirectMessageToCache,
  useDirectMessages,
  type DirectMessage,
} from "@/api/hooks/use-direct-messages";
import { queryKeys } from "@/api/query-keys";

const { mockGET } = vi.hoisted(() => ({ mockGET: vi.fn() }));
vi.mock("@/api/client", () => ({ apiClient: { GET: mockGET } }));

function makeMessage(id: string, overrides: Partial<DirectMessage> = {}): DirectMessage {
  return {
    id,
    conversationId: "c1",
    senderId: "u1",
    recipientId: "u2",
    content: id,
    media: null,
    recalledAt: null,
    createdAt: `2026-08-06T20:00:0${id.slice(-1)}Z`,
    ...overrides,
  };
}

function setup() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  }
  return { client, Wrapper };
}

describe("direct message history", () => {
  test("缓存合并会替换已撤回消息、追加新消息并去重", () => {
    const client = new QueryClient();
    const key = queryKeys.directMessages.messages("u1", "c1");
    client.setQueryData(key, {
      pages: [{ data: [makeMessage("m1")], meta: { cursor: null, hasMore: false } }],
      pageParams: [undefined],
    } satisfies InfiniteData<unknown>);

    appendDirectMessageToCache(client, "u1", "c1", [
      makeMessage("m1", { content: null, recalledAt: "2026-08-06T20:01:00Z" }),
      makeMessage("m2"),
      makeMessage("m2"),
    ]);

    const cached = client.getQueryData<InfiniteData<{ data: DirectMessage[] }>>(key);
    expect(cached?.pages[0].data).toHaveLength(2);
    expect(cached?.pages[0].data[0].recalledAt).not.toBeNull();
  });

  test("空增量或尚未建立历史缓存时不创建伪缓存", () => {
    const client = new QueryClient();
    appendDirectMessageToCache(client, "u1", "c1", []);
    appendDirectMessageToCache(client, "u1", "c1", [makeMessage("m1")]);
    expect(client.getQueryData(queryKeys.directMessages.messages("u1", "c1"))).toBeUndefined();
  });

  test("加载历史并把分页按时间正序合并", async () => {
    mockGET.mockImplementation(async (_path: string, options: { params: { query: { cursor?: string } } }) => {
      const cursor = options.params.query.cursor;
      return cursor
        ? { data: { data: [makeMessage("m0")], meta: { cursor: null, hasMore: false } } }
        : { data: { data: [makeMessage("m1")], meta: { cursor: "m1", hasMore: true } } };
    });
    const { Wrapper } = setup();
    const { result } = renderHook(() => useDirectMessages("c1", "u1"), { wrapper: Wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.messages.map((item) => item.id)).toEqual(["m1"]);
    await act(async () => {
      await result.current.fetchNextPage();
    });
    await waitFor(() => expect(result.current.messages.map((item) => item.id)).toEqual(["m0", "m1"]));
  });

  test("缺少会话 ID、API 错误与空响应均可识别", async () => {
    const { Wrapper } = setup();
    mockGET.mockResolvedValueOnce({ error: { message: "history failed" } });
    const failed = renderHook(() => useDirectMessages("c1", "u1"), { wrapper: Wrapper });
    await waitFor(() => expect(failed.result.current.isError).toBe(true));

    const second = setup();
    mockGET.mockResolvedValue({ data: undefined, error: undefined });
    const empty = renderHook(() => useDirectMessages("c2", "u1"), { wrapper: second.Wrapper });
    await waitFor(() => expect(empty.result.current.isError).toBe(true));
    expect(empty.result.current.error).toEqual(new Error("消息历史响应为空"));
  });
});
