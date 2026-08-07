/** useLogin hook 测试：登录成功后失效通知查询 */

import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, test, expect, vi } from "vitest";
import { useLogin } from "@/api/hooks/use-login";
import { createQueryWrapper } from "@/test/query-client";

const { mockPOST } = vi.hoisted(() => ({
  mockPOST: vi.fn(),
}));

vi.mock("@/api/client", () => ({
  apiClient: { POST: mockPOST },
}));

const loginResponse = {
  data: {
    code: 0,
    message: "ok",
    data: {
      accessToken: "token",
      user: {
        id: "u1",
        email: "a@b.com",
        username: "tester",
        avatar: null,
        role: "user",
        emailVerified: true,
      },
    },
  },
  error: undefined,
};

beforeEach(() => vi.clearAllMocks());

describe("useLogin", () => {
  test("登录成功并失效通知前缀查询（登录后徽标即时刷新）", async () => {
    mockPOST.mockResolvedValue(loginResponse);

    const { client, Wrapper } = createQueryWrapper();
    const invalidateSpy = vi.spyOn(client, "invalidateQueries");
    const { result } = renderHook(() => useLogin(), { wrapper: Wrapper });

    const res = await result.current.mutateAsync({
      account: "a@b.com",
      password: "secret",
    });
    expect(res.code).toBe(0);
    expect(mockPOST).toHaveBeenCalledWith("/api/v1/auth/login", {
      body: { account: "a@b.com", password: "secret" },
    });
    await waitFor(() =>
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["notifications"] }),
    );
  });

  test("登录 API 错误原样抛出且不失效通知", async () => {
    const error = { message: "账号或密码错误" };
    mockPOST.mockResolvedValue({ data: undefined, error });
    const { client, Wrapper } = createQueryWrapper();
    const invalidate = vi.spyOn(client, "invalidateQueries");
    const { result } = renderHook(() => useLogin(), { wrapper: Wrapper });

    await act(async () => {
      await expect(result.current.mutateAsync({
        account: "a@b.com",
        password: "wrong",
      })).rejects.toEqual(error);
    });
    expect(invalidate).not.toHaveBeenCalled();
  });

  test("登录空成功响应视为契约错误", async () => {
    mockPOST.mockResolvedValue({ data: undefined, error: undefined });
    const { Wrapper } = createQueryWrapper();
    const { result } = renderHook(() => useLogin(), { wrapper: Wrapper });

    await act(async () => {
      await expect(result.current.mutateAsync({
        account: "a@b.com",
        password: "secret",
      })).rejects.toThrow("登录响应为空");
    });
  });
});
