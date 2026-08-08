import React from "react";
import { QueryClient, QueryClientProvider, type InfiniteData } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";
import {
  appendDirectMessageToCache,
  reconcileDirectMessagesInCache,
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
    sticker: null,
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

  test("最近页对账只更新已加载消息，不把窗口中更早的记录追加到底部", () => {
    const client = new QueryClient();
    const key = queryKeys.directMessages.messages("u1", "c1");
    const loaded = Array.from({ length: 30 }, (_, index) => makeMessage(`m${index + 21}`, {
      createdAt: new Date(Date.UTC(2026, 7, 6, 20, 0, index + 21)).toISOString(),
    }));
    const reconciliation = Array.from({ length: 50 }, (_, index) => makeMessage(`m${index + 1}`, {
      createdAt: new Date(Date.UTC(2026, 7, 6, 20, 0, index + 1)).toISOString(),
      ...(index === 20 ? { content: null, recalledAt: "2026-08-06T21:00:00Z" } : {}),
    }));
    client.setQueryData(key, {
      pages: [{ data: loaded, meta: { cursor: "m21", hasMore: true } }],
      pageParams: [undefined],
    } satisfies InfiniteData<unknown>);

    reconcileDirectMessagesInCache(client, "u1", "c1", reconciliation);

    const cached = client.getQueryData<InfiniteData<{ data: DirectMessage[] }>>(key);
    expect(cached?.pages[0].data.map((message) => message.id)).toEqual(
      loaded.map((message) => message.id),
    );
    expect(cached?.pages[0].data[0].recalledAt).toBe("2026-08-06T21:00:00Z");
  });

  test("重叠来源即使乱序写入缓存，暴露给时间线的消息仍保持时间正序", async () => {
    const newestWindow = Array.from({ length: 30 }, (_, index) => makeMessage(`m${index + 21}`, {
      createdAt: new Date(Date.UTC(2026, 7, 6, 20, 0, index + 21)).toISOString(),
    }));
    mockGET.mockImplementation(async (_path: string, options: {
      params: { query: { limit: number; after?: string } };
    }) => {
      const { after } = options.params.query;
      if (after) {
        return { data: { data: [], meta: { cursor: null, hasMore: false } } };
      }
      return { data: { data: newestWindow, meta: { cursor: null, hasMore: false } } };
    });
    const { client, Wrapper } = setup();
    const { result } = renderHook(() => useDirectMessages("c1", "u1"), { wrapper: Wrapper });

    await waitFor(() => expect(result.current.messages).toHaveLength(30));
    act(() => {
      appendDirectMessageToCache(client, "u1", "c1", [makeMessage("m20", {
        createdAt: new Date(Date.UTC(2026, 7, 6, 20, 0, 20)).toISOString(),
      })]);
    });

    await waitFor(() => expect(result.current.messages[0]?.id).toBe("m20"));
    expect(result.current.messages.at(-1)?.id).toBe("m50");
  });

  test("加载历史、按 after 增量同步并把分页按时间正序合并", async () => {
    mockGET.mockImplementation(async (_path: string, options: {
      params: { query: { cursor?: string; after?: string } };
    }) => {
      const { cursor, after } = options.params.query;
      if (after) {
        return { data: { data: [makeMessage("m2")], meta: { cursor: null, hasMore: false } } };
      }
      return cursor
        ? { data: { data: [makeMessage("m0")], meta: { cursor: null, hasMore: false } } }
        : { data: { data: [makeMessage("m1")], meta: { cursor: "m1", hasMore: true } } };
    });
    const { Wrapper } = setup();
    const { result } = renderHook(() => useDirectMessages("c1", "u1"), { wrapper: Wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    await waitFor(() => expect(result.current.messages.map((item) => item.id)).toEqual(["m1", "m2"]));
    expect(mockGET).toHaveBeenCalledWith(
      "/api/v1/direct-conversations/{id}/messages",
      expect.objectContaining({
        params: expect.objectContaining({
          query: { limit: 50, after: "m1" },
        }),
      }),
    );
    await act(async () => {
      await result.current.fetchNextPage();
    });
    await waitFor(() => expect(result.current.messages.map((item) => item.id)).toEqual([
      "m0",
      "m1",
      "m2",
    ]));
  });

  test("增量合并后立即使用新的消息游标继续追到真正最新", async () => {
    mockGET.mockImplementation(async (_path: string, options: {
      params: { query: { after?: string } };
    }) => {
      const { after } = options.params.query;
      if (!after) {
        return { data: { data: [makeMessage("m1")], meta: { cursor: null, hasMore: false } } };
      }
      if (after === "m1") {
        return { data: { data: [makeMessage("m2")], meta: { cursor: null, hasMore: false } } };
      }
      if (after === "m2") {
        return { data: { data: [makeMessage("m3")], meta: { cursor: null, hasMore: false } } };
      }
      return { data: { data: [], meta: { cursor: null, hasMore: false } } };
    });
    const { Wrapper } = setup();
    const { result } = renderHook(() => useDirectMessages("c1", "u1"), { wrapper: Wrapper });

    await waitFor(() => expect(result.current.messages.map((item) => item.id)).toEqual([
      "m1",
      "m2",
      "m3",
    ]));
    expect(mockGET).toHaveBeenCalledWith(
      "/api/v1/direct-conversations/{id}/messages",
      expect.objectContaining({
        params: expect.objectContaining({ query: { limit: 50, after: "m2" } }),
      }),
    );
  });

  test("低频对账会替换最近一页中已撤回的旧消息", async () => {
    mockGET.mockImplementation(async (_path: string, options: {
      params: { query: { limit: number; after?: string } };
    }) => {
      const { limit, after } = options.params.query;
      if (after) {
        return { data: { data: [], meta: { cursor: null, hasMore: false } } };
      }
      if (limit === 50) {
        return {
          data: {
            data: [makeMessage("m1", { content: null, recalledAt: "2026-08-06T20:01:00Z" })],
            meta: { cursor: null, hasMore: false },
          },
        };
      }
      return { data: { data: [makeMessage("m1")], meta: { cursor: null, hasMore: false } } };
    });
    const { client, Wrapper } = setup();
    const { result } = renderHook(() => useDirectMessages("c1", "u1"), { wrapper: Wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    await act(async () => {
      await client.invalidateQueries({
        queryKey: queryKeys.directMessages.reconciliation("u1", "c1"),
      });
    });
    await waitFor(() => expect(result.current.messages[0]?.recalledAt).not.toBeNull());
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
