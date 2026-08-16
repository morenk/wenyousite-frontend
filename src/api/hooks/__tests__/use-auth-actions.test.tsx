import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";
import {
  useChangeEmailRequest,
  useChangeEmailVerify,
  useChangePassword,
  useForgotPassword,
  useLogout,
  useResetPassword,
} from "@/api/hooks/use-auth-actions";
import { queryKeys } from "@/api/query-keys";
import { createQueryWrapper } from "@/test/query-client";

const { mockPOST } = vi.hoisted(() => ({ mockPOST: vi.fn() }));

vi.mock("@/api/client", () => ({
  apiClient: { POST: mockPOST },
}));

beforeEach(() => {
  vi.clearAllMocks();
  mockPOST.mockResolvedValue({
    data: { code: 0, message: "ok", data: { accepted: true } },
    error: undefined,
  });
});

describe("认证动作 hooks", () => {
  test("忘记密码、重置与登出使用各自契约端点", async () => {
    const { Wrapper } = createQueryWrapper();
    const { result } = renderHook(() => ({
      forgot: useForgotPassword(),
      reset: useResetPassword(),
      logout: useLogout(),
    }), { wrapper: Wrapper });

    await act(async () => {
      await result.current.forgot.mutateAsync({ email: "user@example.com" });
      await result.current.reset.mutateAsync({
        email: "user@example.com",
        token: "reset-token",
        newPassword: "new-password",
      });
      await result.current.logout.mutateAsync();
    });

    expect(mockPOST).toHaveBeenNthCalledWith(1, "/api/v1/auth/forgot-password", {
      body: { email: "user@example.com" },
    });
    expect(mockPOST).toHaveBeenNthCalledWith(2, "/api/v1/auth/reset-password", {
      body: {
        email: "user@example.com",
        token: "reset-token",
        newPassword: "new-password",
      },
    });
    expect(mockPOST).toHaveBeenNthCalledWith(3, "/api/v1/auth/logout", { body: {} });
  });

  test("修改密码和邮箱请求完整转发敏感字段", async () => {
    const { Wrapper } = createQueryWrapper();
    const { result } = renderHook(() => ({
      password: useChangePassword(),
      email: useChangeEmailRequest(),
    }), { wrapper: Wrapper });

    await act(async () => {
      await result.current.password.mutateAsync({
        oldPassword: "old-password",
        newPassword: "new-password",
      });
      await result.current.email.mutateAsync({
        newEmail: "new@example.com",
        oldPassword: "old-password",
      });
    });

    expect(mockPOST).toHaveBeenNthCalledWith(1, "/api/v1/auth/change-password", {
      body: { oldPassword: "old-password", newPassword: "new-password" },
    });
    expect(mockPOST).toHaveBeenNthCalledWith(2, "/api/v1/auth/change-email/request-code", {
      body: { newEmail: "new@example.com", oldPassword: "old-password" },
    });
  });

  test("邮箱修改确认成功后失效当前用户资料", async () => {
    const { client, Wrapper } = createQueryWrapper();
    const invalidate = vi.spyOn(client, "invalidateQueries");
    const { result } = renderHook(() => useChangeEmailVerify(), { wrapper: Wrapper });

    await act(async () => {
      await result.current.mutateAsync({ newEmail: "new@example.com", code: "123456" });
    });

    expect(mockPOST).toHaveBeenCalledWith("/api/v1/auth/change-email/verify", {
      body: { newEmail: "new@example.com", code: "123456" },
    });
    await waitFor(() => {
      expect(invalidate).toHaveBeenCalledWith({ queryKey: queryKeys.me });
    });
  });

  test("API 错误原样交给表单层处理", async () => {
    const error = { code: 40001, message: "验证码无效" };
    mockPOST.mockResolvedValueOnce({ data: undefined, error });
    const { Wrapper } = createQueryWrapper();
    const { result } = renderHook(() => useResetPassword(), { wrapper: Wrapper });

    await act(async () => {
      await expect(result.current.mutateAsync({
        email: "user@example.com",
        token: "bad-token",
        newPassword: "new-password",
      })).rejects.toEqual(error);
    });
  });
});
