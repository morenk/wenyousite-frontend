import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";
import {
  useDirectMessageActions,
  useStartDirectConversation,
} from "@/api/hooks/use-direct-message-actions";

const { mockGET, mockPOST, mockPATCH, mockDELETE } = vi.hoisted(() => ({
  mockGET: vi.fn(),
  mockPOST: vi.fn(),
  mockPATCH: vi.fn(),
  mockDELETE: vi.fn(),
}));

vi.mock("@/api/client", () => ({
  apiClient: { GET: mockGET, POST: mockPOST, PATCH: mockPATCH, DELETE: mockDELETE },
}));

function setup<T>(hook: () => T) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  }
  return { ...renderHook(hook, { wrapper: Wrapper }), client };
}

const message = {
  id: "m1",
  conversationId: "c1",
  senderId: "u1",
  recipientId: "u2",
  content: "你好",
  media: null,
  recalledAt: null,
  createdAt: "2026-08-06T20:00:00Z",
};
const conversation = {
  id: "c1",
  status: "ACCEPTED",
  requestDirection: "NONE",
  otherUser: { id: "u2", username: "B", avatar: null, isDeactivated: false },
  lastMessage: null,
  unreadCount: 0,
  archivedAt: null,
  lastMessageAt: message.createdAt,
  createdAt: message.createdAt,
  canSend: true,
  canAccept: false,
  canDecline: false,
  isBlocked: false,
};

beforeEach(() => {
  vi.clearAllMocks();
  mockPOST.mockResolvedValue({ data: { data: message }, error: undefined });
  mockPATCH.mockResolvedValue({ data: { data: conversation }, error: undefined });
  mockDELETE.mockResolvedValue({
    data: { data: { message: "消息已撤回", conversationCanceled: false } },
    error: undefined,
  });
});

describe("direct message action hooks", () => {
  test("发起会话并返回会话与首条消息", async () => {
    mockPOST.mockResolvedValueOnce({
      data: { data: { conversation, message } },
      error: undefined,
    });
    const { result } = setup(() => useStartDirectConversation("u1"));

    await act(async () => {
      await expect(result.current.mutateAsync({
        recipientId: "u2",
        content: "你好",
        clientRequestId: "99454040-6a52-4bf3-8bad-42683c4d09be",
      })).resolves.toEqual({ conversation, message });
    });
    expect(mockPOST).toHaveBeenCalledWith("/api/v1/direct-conversations", {
      body: expect.objectContaining({ recipientId: "u2" }),
    });
  });

  test("发起会话遇到 API 错误或空响应时抛出", async () => {
    const { result, rerender } = setup(() => useStartDirectConversation("u1"));
    mockPOST.mockResolvedValueOnce({ error: { message: "blocked" } });
    await act(async () => {
      await expect(result.current.mutateAsync({
        recipientId: "u2",
        content: "x",
        clientRequestId: "99454040-6a52-4bf3-8bad-42683c4d09be",
      })).rejects.toEqual({ message: "blocked" });
    });
    rerender();
    mockPOST.mockResolvedValueOnce({ data: undefined, error: undefined });
    await act(async () => {
      await expect(result.current.mutateAsync({
        recipientId: "u2",
        content: "x",
        clientRequestId: "99454040-6a52-4bf3-8bad-42683c4d09be",
      })).rejects.toThrow("发起私聊响应为空");
    });
  });

  test("发送、处理请求、归档、已读与撤回调用各自端点", async () => {
    const { result } = setup(() => useDirectMessageActions("c1", "u1"));

    await act(async () => {
      await result.current.send.mutateAsync({
        content: "你好",
        clientRequestId: "99454040-6a52-4bf3-8bad-42683c4d09be",
      });
      await result.current.handleRequest.mutateAsync("ACCEPT");
      await result.current.setArchived.mutateAsync(true);
      await result.current.markRead.mutateAsync("m1");
      await result.current.recall.mutateAsync("m1");
    });

    expect(mockPOST).toHaveBeenCalledWith(
      "/api/v1/direct-conversations/{id}/messages",
      expect.objectContaining({ params: { path: { id: "c1" } } }),
    );
    expect(mockPATCH).toHaveBeenCalledWith(
      "/api/v1/direct-conversations/{id}/request",
      { params: { path: { id: "c1" } }, body: { action: "ACCEPT" } },
    );
    expect(mockPATCH).toHaveBeenCalledWith(
      "/api/v1/direct-conversations/{id}/archive",
      { params: { path: { id: "c1" } }, body: { archived: true } },
    );
    expect(mockPOST).toHaveBeenCalledWith(
      "/api/v1/direct-conversations/{id}/read",
      { params: { path: { id: "c1" } }, body: { throughMessageId: "m1" } },
    );
    expect(mockDELETE).toHaveBeenCalledWith("/api/v1/direct-messages/{id}", {
      params: { path: { id: "m1" } },
    });
  });

  test("各 mutation 对 API 错误与空成功响应进行防御", async () => {
    const { result } = setup(() => useDirectMessageActions("c1", "u1"));
    mockPOST.mockResolvedValueOnce({ error: { message: "send failed" } });
    await act(async () => {
      await expect(result.current.send.mutateAsync({
        content: "x",
        clientRequestId: "99454040-6a52-4bf3-8bad-42683c4d09be",
      })).rejects.toEqual({ message: "send failed" });
    });
    mockPATCH.mockResolvedValueOnce({ data: undefined, error: undefined });
    await act(async () => {
      await expect(result.current.handleRequest.mutateAsync("DECLINE")).rejects.toThrow(
        "处理消息请求响应为空",
      );
    });
    mockPATCH.mockResolvedValueOnce({ data: undefined, error: undefined });
    await act(async () => {
      await expect(result.current.setArchived.mutateAsync(false)).rejects.toThrow("归档响应为空");
    });
    mockPOST.mockResolvedValueOnce({ error: { message: "read failed" } });
    await act(async () => {
      await expect(result.current.markRead.mutateAsync("m1")).rejects.toEqual({ message: "read failed" });
    });
    mockDELETE.mockResolvedValueOnce({ data: undefined, error: undefined });
    await act(async () => {
      await expect(result.current.recall.mutateAsync("m1")).rejects.toThrow("撤回响应为空");
    });
  });
});
