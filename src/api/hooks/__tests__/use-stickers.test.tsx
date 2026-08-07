import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";
import {
  saveStickerSource,
  useStickerActions,
  useStickers,
} from "@/api/hooks/use-stickers";
import { queryKeys } from "@/api/query-keys";

const { mockGET, mockPOST, mockPUT, mockDELETE } = vi.hoisted(() => ({
  mockGET: vi.fn(),
  mockPOST: vi.fn(),
  mockPUT: vi.fn(),
  mockDELETE: vi.fn(),
}));

vi.mock("@/api/client", () => ({
  apiClient: { GET: mockGET, POST: mockPOST, PUT: mockPUT, DELETE: mockDELETE },
}));

const favorite = {
  id: "favorite-1",
  position: 0,
  lastUsedAt: null,
  asset: {
    id: "asset-1",
    url: "https://cdn.example.com/sticker.webp",
    thumbnailUrl: "https://cdn.example.com/sticker-thumb.webp",
    width: 128,
    height: 128,
    animated: false,
    frameCount: 1,
    durationMs: 0,
  },
  markdown: "![表情](https://cdn.example.com/sticker.webp \"wenyousite-sticker:v1:asset-1\")",
};

const collection = {
  version: 2,
  limit: 200,
  items: [favorite],
  recent: [],
  pendingImports: [],
};

const completedImport = {
  id: "import-1",
  status: "COMPLETED" as const,
  favorite,
  failureCode: null,
  failureMessage: null,
  alreadySaved: false,
};

function setup<T>(hook: () => T) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  }
  return { ...renderHook(hook, { wrapper: Wrapper }), client };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockGET.mockResolvedValue({ data: { data: collection }, error: undefined });
  mockPOST.mockResolvedValue({ data: { data: completedImport }, error: undefined });
  mockPUT.mockResolvedValue({ data: { data: collection }, error: undefined });
  mockDELETE.mockResolvedValue({ data: { data: collection }, error: undefined });
});

describe("sticker API hooks", () => {
  test("按用户读取收藏，并响应跨组件刷新事件", async () => {
    const { result } = setup(() => useStickers("user-1"));
    await waitFor(() => expect(result.current.data).toEqual(collection));

    window.dispatchEvent(new Event("stickers:changed"));
    await waitFor(() => expect(mockGET).toHaveBeenCalledTimes(2));
    expect(mockGET).toHaveBeenCalledWith("/api/v1/stickers");
  });

  test("快速收藏分别提交私聊消息和帖子图片来源", async () => {
    await expect(saveStickerSource({ directMessageId: "message-1" })).resolves.toEqual(
      completedImport,
    );
    await expect(
      saveStickerSource({ postId: "post-1", imageUrl: "https://cdn.example.com/image.png" }),
    ).resolves.toEqual(completedImport);

    expect(mockPOST).toHaveBeenNthCalledWith(
      1,
      "/api/v1/stickers/imports/direct-message",
      { body: { directMessageId: "message-1", clientRequestId: expect.any(String) } },
    );
    expect(mockPOST).toHaveBeenNthCalledWith(
      2,
      "/api/v1/stickers/imports/post-image",
      {
        body: {
          postId: "post-1",
          imageUrl: "https://cdn.example.com/image.png",
          clientRequestId: expect.any(String),
        },
      },
    );
  });

  test("导入、排序和移除都使用对应端点并更新收藏缓存", async () => {
    const { result, client } = setup(() => useStickerActions("user-1"));

    await act(async () => {
      await result.current.importMedia.mutateAsync("media-1");
      await result.current.importDirectMessage.mutateAsync("message-1");
      await result.current.importPostImage.mutateAsync({
        postId: "post-1",
        imageUrl: "https://cdn.example.com/image.png",
      });
      await result.current.reorder.mutateAsync({ version: 2, favoriteIds: ["favorite-1"] });
      await result.current.remove.mutateAsync("favorite-1");
    });

    expect(mockPOST).toHaveBeenCalledWith("/api/v1/stickers/imports/media", {
      body: { mediaId: "media-1", clientRequestId: expect.any(String) },
    });
    expect(mockPUT).toHaveBeenCalledWith("/api/v1/stickers/reorder", {
      body: { version: 2, favoriteIds: ["favorite-1"] },
    });
    expect(mockDELETE).toHaveBeenCalledWith("/api/v1/stickers/{favoriteId}", {
      params: { path: { favoriteId: "favorite-1" } },
    });
    expect(client.getQueryData(queryKeys.stickers("user-1"))).toEqual(collection);
  });

  test("API 错误和失败导入保持可识别错误", async () => {
    mockPOST.mockResolvedValueOnce({ error: { message: "forbidden" } });
    await expect(saveStickerSource({ directMessageId: "message-1" })).rejects.toEqual({
      message: "forbidden",
    });

    mockPOST.mockResolvedValueOnce({
      data: {
        data: {
          ...completedImport,
          status: "FAILED",
          failureMessage: "动图不能超过 120 帧",
        },
      },
      error: undefined,
    });
    const { result } = setup(() => useStickerActions("user-1"));
    await act(async () => {
      await expect(result.current.importMedia.mutateAsync("media-1")).rejects.toThrow(
        "动图不能超过 120 帧",
      );
    });
  });
});
