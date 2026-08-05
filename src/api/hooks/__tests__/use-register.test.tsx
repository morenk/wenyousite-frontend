/** useRegisterComplete hook 测试：注册成功后失效通知查询 */

import { describe, test, expect, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useRegisterComplete } from "@/api/hooks/use-register";
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
        emailVerified: true,
      },
    },
  },
  error: undefined,
};

describe("useRegisterComplete", () => {
  test("注册成功并失效通知前缀查询", async () => {
    mockPOST.mockResolvedValue(registerResponse);

    const { qc, Wrapper } = createWrapper();
    const invalidateSpy = vi.spyOn(qc, "invalidateQueries");
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
});
