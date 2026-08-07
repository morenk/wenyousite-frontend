import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { useTag, useTags } from "@/api/hooks/use-tags";
import { createQueryWrapper } from "@/test/query-client";

const { mockGET } = vi.hoisted(() => ({ mockGET: vi.fn() }));

vi.mock("@/api/client", () => ({
  apiClient: { GET: mockGET },
}));

beforeEach(() => vi.clearAllMocks());

describe("useTag", () => {
  test("按 ID 获取标签详情", async () => {
    mockGET.mockResolvedValue({
      data: {
        code: 0,
        message: "ok",
        data: {
          id: "cms7rnyij000z7qdyg6zbge8e",
          name: "无限流",
          color: null,
          createdAt: "2026-08-07T00:00:00Z",
        },
      },
      error: undefined,
    });

    const { Wrapper } = createQueryWrapper();
    const { result } = renderHook(() => useTag("cms7rnyij000z7qdyg6zbge8e"), { wrapper: Wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockGET).toHaveBeenCalledWith("/api/v1/tags/{id}", {
      params: { path: { id: "cms7rnyij000z7qdyg6zbge8e" } },
    });
    expect(result.current.data?.name).toBe("无限流");
  });

  test("标签接口失败时进入错误状态", async () => {
    mockGET.mockResolvedValue({
      data: undefined,
      error: { message: "标签不存在" },
    });

    const { Wrapper } = createQueryWrapper();
    const { result } = renderHook(() => useTag("missing-tag"), { wrapper: Wrapper });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });

  test("搜索标签时裁剪关键词", async () => {
    mockGET.mockResolvedValue({
      data: { data: [{ id: "tag-1", name: "剧情" }] },
      error: undefined,
    });
    const { Wrapper } = createQueryWrapper();
    const { result } = renderHook(() => useTags("  剧情  "), { wrapper: Wrapper });

    await waitFor(() => expect(result.current.data?.[0]?.name).toBe("剧情"));
    expect(mockGET).toHaveBeenCalledWith("/api/v1/tags", {
      params: { query: { q: "剧情" } },
    });
  });

  test("空关键词时不请求标签搜索", () => {
    const { Wrapper } = createQueryWrapper();
    const { result } = renderHook(() => useTags("   "), { wrapper: Wrapper });
    expect(result.current.fetchStatus).toBe("idle");
    expect(mockGET).not.toHaveBeenCalled();
  });

  test("标签搜索空响应进入错误态", async () => {
    mockGET.mockResolvedValue({ data: undefined, error: undefined });
    const { Wrapper } = createQueryWrapper();
    const { result } = renderHook(() => useTags("剧情"), { wrapper: Wrapper });
    await waitFor(() => {
      expect(result.current.error).toEqual(new Error("标签列表响应为空"));
    });
  });
});
