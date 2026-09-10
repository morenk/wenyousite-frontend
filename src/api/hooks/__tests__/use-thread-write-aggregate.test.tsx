import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { useSaveThreadAggregate } from "@/api/hooks/use-save-thread-aggregate";
import { useUpsertBody } from "@/api/hooks/use-upsert-body";
import { queryKeys } from "@/api/query-keys";
import { createQueryWrapper } from "@/test/query-client";

const { mockPATCH, mockPUT, mockViewer } = vi.hoisted(() => ({
  mockPATCH: vi.fn(),
  mockPUT: vi.fn(),
  mockViewer: { scope: "u1" },
}));

vi.mock("@/api/client", () => ({
  apiClient: { PATCH: mockPATCH, PUT: mockPUT },
}));

vi.mock("@/api/use-viewer-scope", () => ({ useViewerScope: () => mockViewer.scope }));

const rawThread = {
  id: "t1",
  title: "更新后的主题",
  defaultSubthreadId: "s1",
  subthreads: [{ id: "s1", title: "主帖", postingPolicy: "PLAYERS", postingCapability: { canPost: true, denialReason: null } }],
};

beforeEach(() => { vi.clearAllMocks(); mockViewer.scope = "u1"; });

describe("主题帖聚合写入 hooks", () => {
  test("聚合保存仅更新当前访问者权限投影并失效其他详情", async () => {
    mockPATCH.mockResolvedValue({
      data: { code: 0, message: "ok", data: rawThread },
      error: undefined,
    });
    const { client, Wrapper } = createQueryWrapper();
    const viewerKey = queryKeys.threads.detailForViewer("t1", "u1");
    const anonymousKey = queryKeys.threads.detailForViewer("t1", "anonymous");
    client.setQueryData(viewerKey, { ...rawThread, title: "旧标题" });
    client.setQueryData(anonymousKey, { ...rawThread, title: "旧标题", subthreads: [{ id: "s1", postingCapability: { canPost: false, denialReason: "LOGIN_REQUIRED" } }] });
    const invalidate = vi.spyOn(client, "invalidateQueries");
    const { result } = renderHook(() => useSaveThreadAggregate(), { wrapper: Wrapper });
    const body = {
      title: "更新后的主题",
      category: "RPG" as const,
      visibility: "PUBLIC" as const,
      version: 1,
      defaultSubthreadVersion: 1,
      content: "正文",
      tagNames: [],
    };

    await act(async () => {
      await result.current.mutateAsync({ threadId: "t1", body });
    });

    expect(mockPATCH).toHaveBeenCalledWith("/api/v1/threads/{id}/aggregate", {
      params: { path: { id: "t1" } },
      body,
    });
    expect(client.getQueryData<{ title: string }>(viewerKey)?.title).toBe("更新后的主题");
    expect(client.getQueryData<{ title: string }>(anonymousKey)?.title).toBe("旧标题");
    expect(client.getQueryData(anonymousKey)).toEqual(expect.objectContaining({ subthreads: [{ id: "s1", postingCapability: { canPost: false, denialReason: "LOGIN_REQUIRED" } }] }));
    expect(invalidate).toHaveBeenCalledWith({ queryKey: queryKeys.threads.detail("t1") });
    expect(client.getQueryData(viewerKey)).toEqual(expect.objectContaining({ defaultSubthread: expect.objectContaining({ postingPolicy: "PLAYERS", postingCapability: { canPost: true, denialReason: null } }) }));
    expect(client.getQueryData(queryKeys.threads.detail("t1"))).toBeUndefined();
    await waitFor(() => {
      expect(invalidate).toHaveBeenCalledWith({ queryKey: queryKeys.threads.all });
      expect(invalidate).toHaveBeenCalledWith({ queryKey: queryKeys.threadDrafts });
    });
  });

  test("保存请求期间切换账号不会将管理者能力写入新账号", async () => {
    let finish!: (value: unknown) => void;
    mockPATCH.mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }));
    const { client, Wrapper } = createQueryWrapper();
    const nextViewerKey = queryKeys.threads.detailForViewer("t1", "u2");
    const nextViewerData = { title: "另一个账号", postingCapability: { canPost: false } };
    client.setQueryData(nextViewerKey, nextViewerData);
    const { result, rerender } = renderHook(() => useSaveThreadAggregate(), { wrapper: Wrapper });
    act(() => result.current.mutate({ threadId: "t1", body: { version: 1, defaultSubthreadVersion: 1, content: "正文", tagNames: [], defaultSubthreadPostingPolicy: "PLAYERS" } }));
    await waitFor(() => expect(mockPATCH).toHaveBeenCalledOnce());
    mockViewer.scope = "u2";
    rerender();
    await act(async () => { finish({ data: { code: 0, message: "ok", data: rawThread } }); });
    expect(client.getQueryData(nextViewerKey)).toEqual(nextViewerData);
    expect(client.getQueryData(queryKeys.threads.detailForViewer("t1", "u1"))).toEqual(expect.objectContaining({ defaultSubthread: expect.objectContaining({ postingPolicy: "PLAYERS" }) }));
  });

  test("聚合保存拒绝 API 错误和空成功响应", async () => {
    const error = { message: "版本冲突" };
    mockPATCH.mockResolvedValueOnce({ data: undefined, error });
    const first = createQueryWrapper();
    const apiResult = renderHook(() => useSaveThreadAggregate(), { wrapper: first.Wrapper });
    await act(async () => {
      await expect(apiResult.result.current.mutateAsync({
        threadId: "t1",
        body: {
          category: "RPG",
          visibility: "PUBLIC",
          version: 1,
          defaultSubthreadVersion: 1,
          content: "",
          tagNames: [],
        },
      })).rejects.toEqual(error);
    });

    mockPATCH.mockResolvedValueOnce({ data: undefined, error: undefined });
    const second = createQueryWrapper();
    const emptyResult = renderHook(() => useSaveThreadAggregate(), { wrapper: second.Wrapper });
    await act(async () => {
      await expect(emptyResult.result.current.mutateAsync({
        threadId: "t1",
        body: {
          category: "RPG",
          visibility: "PUBLIC",
          version: 1,
          defaultSubthreadVersion: 1,
          content: "",
          tagNames: [],
        },
      })).rejects.toThrow("保存主题帖响应为空");
    });
  });

  test("正文 upsert 传递乐观锁版本并失效楼层与主题详情", async () => {
    const savedPost = { id: "p1", subthreadId: "s1", content: "新正文", version: 3 };
    mockPUT.mockResolvedValue({
      data: { code: 0, message: "ok", data: savedPost },
      error: undefined,
    });
    const { client, Wrapper } = createQueryWrapper();
    const invalidate = vi.spyOn(client, "invalidateQueries");
    const { result } = renderHook(() => useUpsertBody(), { wrapper: Wrapper });

    await act(async () => {
      await expect(result.current.mutateAsync({
        threadId: "t1",
        subthreadId: "s1",
        content: "新正文",
        version: 2,
      })).resolves.toEqual(savedPost);
    });

    expect(mockPUT).toHaveBeenCalledWith("/api/v1/subthreads/{subthreadId}/body", {
      params: { path: { subthreadId: "s1" } },
      body: { content: "新正文", version: 2 },
    });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: queryKeys.floors.all });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: queryKeys.threads.detail("t1") });
  });

  test("正文 upsert 对空响应防御", async () => {
    mockPUT.mockResolvedValue({ data: undefined, error: undefined });
    const { Wrapper } = createQueryWrapper();
    const { result } = renderHook(() => useUpsertBody(), { wrapper: Wrapper });

    await act(async () => {
      await expect(result.current.mutateAsync({
        threadId: "t1",
        subthreadId: "s1",
        content: "正文",
      })).rejects.toThrow("保存正文响应为空");
    });
  });
});
