import { beforeEach, describe, expect, test, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";
import {
  useFloorAuthors,
  useReplyAuthors,
} from "@/api/hooks/use-discussion-authors";

const { mockGET } = vi.hoisted(() => ({ mockGET: vi.fn() }));

vi.mock("@/api/client", () => ({
  apiClient: { GET: mockGET },
}));

function createWrapper() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  }
  return Wrapper;
}

const scopedAuthor = {
  id: "player-1",
  username: "当前楼玩家",
  avatar: null,
  level: 2,
  role: "PARTICIPANT" as const,
  playerMarked: true,
};

describe("discussion author hooks", () => {
  beforeEach(() => mockGET.mockReset());

  test("楼层候选从当前子贴专用端点独立读取", async () => {
    mockGET.mockResolvedValue({
      data: { code: 0, message: "ok", data: [scopedAuthor] },
      error: undefined,
    });

    const { result } = renderHook(() => useFloorAuthors("subthread-1", "viewer-1"), {
      wrapper: createWrapper(),
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual([scopedAuthor]);
    expect(mockGET).toHaveBeenCalledWith(
      "/api/v1/subthreads/{subthreadId}/posts/authors",
      { params: { path: { subthreadId: "subthread-1" } } },
    );
  });

  test("楼中楼候选只请求当前主楼层范围", async () => {
    mockGET.mockResolvedValue({
      data: { code: 0, message: "ok", data: [scopedAuthor] },
      error: undefined,
    });

    const { result } = renderHook(() => useReplyAuthors("floor-1"), {
      wrapper: createWrapper(),
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockGET).toHaveBeenCalledWith(
      "/api/v1/posts/{id}/replies/authors",
      { params: { path: { id: "floor-1" } } },
    );
  });

  test("缺少讨论范围时不发请求", () => {
    const { result } = renderHook(() => useReplyAuthors(undefined), {
      wrapper: createWrapper(),
    });

    expect(result.current.fetchStatus).toBe("idle");
    expect(mockGET).not.toHaveBeenCalled();
  });
});
