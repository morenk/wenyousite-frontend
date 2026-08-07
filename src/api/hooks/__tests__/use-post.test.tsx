import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { usePost } from "@/api/hooks/use-post";
import { queryKeys } from "@/api/query-keys";
import { createQueryWrapper } from "@/test/query-client";

const { mockGET } = vi.hoisted(() => ({ mockGET: vi.fn() }));

vi.mock("@/api/client", () => ({ apiClient: { GET: mockGET } }));
vi.mock("@/api/use-viewer-scope", () => ({ useViewerScope: () => "viewer-u1" }));

const post = {
  id: "p1",
  threadId: "t1",
  subthreadId: "s1",
  parentId: null,
  content: "楼层正文",
};

beforeEach(() => vi.clearAllMocks());

describe("usePost", () => {
  test("按访问者隔离缓存并请求帖子详情", async () => {
    mockGET.mockResolvedValue({
      data: { code: 0, message: "ok", data: post },
      error: undefined,
    });
    const { client, Wrapper } = createQueryWrapper();
    const { result } = renderHook(() => usePost("p1"), { wrapper: Wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockGET).toHaveBeenCalledWith("/api/v1/posts/{id}", {
      params: { path: { id: "p1" } },
    });
    expect(client.getQueryData(queryKeys.posts.detailForViewer("p1", "viewer-u1"))).toEqual(post);
  });

  test("缺少 ID 时禁用请求", () => {
    const { Wrapper } = createQueryWrapper();
    const { result } = renderHook(() => usePost(), { wrapper: Wrapper });

    expect(result.current.fetchStatus).toBe("idle");
    expect(mockGET).not.toHaveBeenCalled();
  });

  test("API 错误与空响应都进入错误态", async () => {
    const apiError = { message: "无权查看" };
    mockGET.mockResolvedValueOnce({ data: undefined, error: apiError });
    const first = createQueryWrapper();
    const apiResult = renderHook(() => usePost("p1"), { wrapper: first.Wrapper });
    await waitFor(() => expect(apiResult.result.current.error).toEqual(apiError));

    mockGET.mockResolvedValueOnce({ data: undefined, error: undefined });
    const second = createQueryWrapper();
    const emptyResult = renderHook(() => usePost("p2"), { wrapper: second.Wrapper });
    await waitFor(() => {
      expect(emptyResult.result.current.error).toEqual(new Error("帖子详情响应为空"));
    });
  });
});
