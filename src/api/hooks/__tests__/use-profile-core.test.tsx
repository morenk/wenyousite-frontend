import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { useMe } from "@/api/hooks/use-me";
import { useUpdateProfile } from "@/api/hooks/use-update-profile";
import { queryKeys } from "@/api/query-keys";
import { createQueryWrapper } from "@/test/query-client";

const { mockGET, mockPATCH } = vi.hoisted(() => ({
  mockGET: vi.fn(),
  mockPATCH: vi.fn(),
}));

vi.mock("@/api/client", () => ({
  apiClient: { GET: mockGET, PATCH: mockPATCH },
}));

const currentUser = {
  id: "u1",
  email: "user@example.com",
  username: "测试用户",
  avatar: null,
  bio: "简介",
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("当前用户资料 hooks", () => {
  test("读取资料并写入 me 缓存", async () => {
    mockGET.mockResolvedValue({
      data: { code: 0, message: "ok", data: currentUser },
      error: undefined,
    });
    const { client, Wrapper } = createQueryWrapper();
    const { result } = renderHook(() => useMe(), { wrapper: Wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockGET).toHaveBeenCalledWith("/api/v1/users/me");
    expect(result.current.data).toEqual(currentUser);
    expect(client.getQueryData(queryKeys.me)).toEqual(currentUser);
  });

  test("资料 API 错误与空响应都进入错误态", async () => {
    const apiError = { message: "unauthorized" };
    mockGET.mockResolvedValueOnce({ data: undefined, error: apiError });
    const first = createQueryWrapper();
    const apiResult = renderHook(() => useMe(), { wrapper: first.Wrapper });
    await waitFor(() => expect(apiResult.result.current.error).toEqual(apiError));

    mockGET.mockResolvedValueOnce({ data: undefined, error: undefined });
    const second = createQueryWrapper();
    const emptyResult = renderHook(() => useMe(), { wrapper: second.Wrapper });
    await waitFor(() => {
      expect(emptyResult.result.current.error).toEqual(new Error("获取资料失败"));
    });
  });

  test("更新资料后失效 me 缓存", async () => {
    mockPATCH.mockResolvedValue({
      data: { code: 0, message: "ok", data: { ...currentUser, bio: "新简介" } },
      error: undefined,
    });
    const { client, Wrapper } = createQueryWrapper();
    const invalidate = vi.spyOn(client, "invalidateQueries");
    const { result } = renderHook(() => useUpdateProfile(), { wrapper: Wrapper });

    await act(async () => {
      await result.current.mutateAsync({ bio: "新简介", showBookmarks: false });
    });

    expect(mockPATCH).toHaveBeenCalledWith("/api/v1/users/me", {
      body: { bio: "新简介", showBookmarks: false },
    });
    await waitFor(() => {
      expect(invalidate).toHaveBeenCalledWith({ queryKey: queryKeys.me });
    });
  });

  test("更新资料失败时不失效缓存", async () => {
    const error = { message: "用户名已存在" };
    mockPATCH.mockResolvedValue({ data: undefined, error });
    const { client, Wrapper } = createQueryWrapper();
    const invalidate = vi.spyOn(client, "invalidateQueries");
    const { result } = renderHook(() => useUpdateProfile(), { wrapper: Wrapper });

    await act(async () => {
      await expect(result.current.mutateAsync({ username: "taken" })).rejects.toEqual(error);
    });
    expect(invalidate).not.toHaveBeenCalled();
  });
});
