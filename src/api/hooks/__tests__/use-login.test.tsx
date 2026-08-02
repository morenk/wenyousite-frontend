/** useLogin hook 测试：登录成功后失效通知查询 */

import { describe, test, expect, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useLogin } from "@/api/hooks/use-login";
import React from "react";

const { mockPOST } = vi.hoisted(() => ({
  mockPOST: vi.fn(),
}));

vi.mock("@/api/client", () => ({
  apiClient: { POST: mockPOST },
}));

function createWrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
  }
  Wrapper.displayName = "QueryClientWrapper";
  return { qc, Wrapper };
}

const loginResponse = {
  data: {
    code: 0,
    message: "ok",
    data: {
      accessToken: "token",
      refreshToken: "refresh",
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

describe("useLogin", () => {
  test("登录成功并失效通知前缀查询（登录后徽标即时刷新）", async () => {
    mockPOST.mockResolvedValue(loginResponse);

    const { qc, Wrapper } = createWrapper();
    const invalidateSpy = vi.spyOn(qc, "invalidateQueries");
    const { result } = renderHook(() => useLogin(), { wrapper: Wrapper });

    const res = await result.current.mutateAsync({
      email: "a@b.com",
      password: "secret",
    });
    expect(res.code).toBe(0);
    expect(mockPOST).toHaveBeenCalledWith("/api/v1/auth/login", {
      body: { email: "a@b.com", password: "secret" },
    });
    await waitFor(() =>
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["notifications"] }),
    );
  });
});
