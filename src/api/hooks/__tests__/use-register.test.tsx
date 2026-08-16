/** useRegisterComplete hook 测试：注册成功后失效通知查询 */

import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, test, expect, vi } from "vitest";
import { useRegisterComplete, useSendRegisterCode } from "@/api/hooks/use-register";
import { createQueryWrapper } from "@/test/query-client";

const { mockPOST } = vi.hoisted(() => ({
  mockPOST: vi.fn(),
}));

vi.mock("@/api/client", () => ({
  apiClient: { POST: mockPOST },
}));

const registerResponse = {
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
      },
    },
  },
  error: undefined,
};

beforeEach(() => vi.clearAllMocks());

describe("useRegisterComplete", () => {
  test("注册成功并失效通知前缀查询", async () => {
    mockPOST.mockResolvedValue(registerResponse);

    const { client, Wrapper } = createQueryWrapper();
    const invalidateSpy = vi.spyOn(client, "invalidateQueries");
    const { result } = renderHook(() => useRegisterComplete(), { wrapper: Wrapper });

    const res = await result.current.mutateAsync({
      email: "a@b.com",
      code: "123456",
      username: "tester",
      password: "secret",
    });
    expect(res.code).toBe(0);
    expect(mockPOST).toHaveBeenCalledWith(
      "/api/v1/auth/register/verify-and-complete",
      {
        body: { email: "a@b.com", code: "123456", username: "tester", password: "secret" },
      },
    );
    await waitFor(() =>
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["notifications"] }),
    );
  });

  test("发送注册验证码使用独立端点", async () => {
    mockPOST.mockResolvedValue({
      data: { code: 0, message: "验证码已发送", data: { cooldownSeconds: 60 } },
      error: undefined,
    });
    const { Wrapper } = createQueryWrapper();
    const { result } = renderHook(() => useSendRegisterCode(), { wrapper: Wrapper });

    await act(async () => {
      await result.current.mutateAsync("a@b.com");
    });
    expect(mockPOST).toHaveBeenCalledWith("/api/v1/auth/register/request-code", {
      body: { email: "a@b.com" },
    });
  });

  test("验证码与注册空响应都视为契约错误", async () => {
    mockPOST.mockResolvedValue({ data: undefined, error: undefined });
    const code = createQueryWrapper();
    const codeResult = renderHook(() => useSendRegisterCode(), { wrapper: code.Wrapper });
    await act(async () => {
      await expect(codeResult.result.current.mutateAsync("a@b.com")).rejects.toThrow(
        "验证码响应为空",
      );
    });

    const register = createQueryWrapper();
    const registerResult = renderHook(() => useRegisterComplete(), {
      wrapper: register.Wrapper,
    });
    await act(async () => {
      await expect(registerResult.result.current.mutateAsync({
        email: "a@b.com",
        code: "123456",
        username: "tester",
        password: "secret",
      })).rejects.toThrow("注册响应为空");
    });
  });

  test("注册 API 错误原样抛出且不失效通知", async () => {
    const error = { message: "邮箱已注册" };
    mockPOST.mockResolvedValue({ data: undefined, error });
    const { client, Wrapper } = createQueryWrapper();
    const invalidate = vi.spyOn(client, "invalidateQueries");
    const { result } = renderHook(() => useRegisterComplete(), { wrapper: Wrapper });

    await act(async () => {
      await expect(result.current.mutateAsync({
        email: "a@b.com",
        code: "123456",
        username: "tester",
        password: "secret",
      })).rejects.toEqual(error);
    });
    expect(invalidate).not.toHaveBeenCalled();
  });
});
