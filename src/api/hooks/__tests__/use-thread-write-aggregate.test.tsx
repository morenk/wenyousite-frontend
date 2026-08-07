import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { useSaveThreadAggregate } from "@/api/hooks/use-save-thread-aggregate";
import { useUpsertBody } from "@/api/hooks/use-upsert-body";
import { queryKeys } from "@/api/query-keys";
import { createQueryWrapper } from "@/test/query-client";

const { mockPATCH, mockPUT } = vi.hoisted(() => ({
  mockPATCH: vi.fn(),
  mockPUT: vi.fn(),
}));

vi.mock("@/api/client", () => ({
  apiClient: { PATCH: mockPATCH, PUT: mockPUT },
}));

const rawThread = {
  id: "t1",
  title: "更新后的主题",
  defaultSubthreadId: "s1",
  subthreads: [{ id: "s1", title: "主帖" }],
};

beforeEach(() => vi.clearAllMocks());

describe("主题帖聚合写入 hooks", () => {
  test("聚合保存更新所有已存在的访问者详情缓存", async () => {
    mockPATCH.mockResolvedValue({
      data: { code: 0, message: "ok", data: rawThread },
      error: undefined,
    });
    const { client, Wrapper } = createQueryWrapper();
    const viewerKey = queryKeys.threads.detailForViewer("t1", "u1");
    const anonymousKey = queryKeys.threads.detailForViewer("t1", "anonymous");
    client.setQueryData(viewerKey, { ...rawThread, title: "旧标题" });
    client.setQueryData(anonymousKey, { ...rawThread, title: "旧标题" });
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
    expect(client.getQueryData<{ title: string }>(anonymousKey)?.title).toBe("更新后的主题");
    expect(client.getQueryData(queryKeys.threads.detail("t1"))).toBeUndefined();
    await waitFor(() => {
      expect(invalidate).toHaveBeenCalledWith({ queryKey: queryKeys.threads.all });
      expect(invalidate).toHaveBeenCalledWith({ queryKey: queryKeys.threadDrafts });
    });
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
