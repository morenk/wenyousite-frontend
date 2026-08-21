import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const { mockPush, mockReplace, mockUsePathname } = vi.hoisted(() => ({
  mockPush: vi.fn(),
  mockReplace: vi.fn(),
  mockUsePathname: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => mockUsePathname(),
  useRouter: () => ({ push: mockPush, replace: mockReplace }),
}));

import { useLoginRedirect } from "@/hooks/use-login-redirect";
import { buildLoginHref, safeLoginNextPath } from "@/lib/login-redirect";

describe("登录跳转", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUsePathname.mockReturnValue("/threads/thread-1");
    window.history.replaceState(null, "", "/threads/thread-1?tab=posts#floor-3");
  });

  afterEach(() => {
    window.history.replaceState(null, "", "/");
  });

  test.each(["https://evil.example", "//evil.example", "/\\evil.example", ""])(
    "拒绝不安全返回路径 %s",
    (next) => {
      expect(safeLoginNextPath(next)).toBe("/");
      expect(buildLoginHref(next)).toBe("/login?next=%2F");
    },
  );

  test("默认保留当前路径、查询参数和页内锚点", () => {
    const { result } = renderHook(() => useLoginRedirect());

    act(() => result.current());

    expect(mockPush).toHaveBeenCalledWith(
      "/login?next=%2Fthreads%2Fthread-1%3Ftab%3Dposts%23floor-3",
    );
  });

  test("支持显式返回路径与 replace", () => {
    const { result } = renderHook(() => useLoginRedirect());

    act(() => result.current({ next: "/join/invite-token", replace: true }));

    expect(mockReplace).toHaveBeenCalledWith(
      "/login?next=%2Fjoin%2Finvite-token",
    );
    expect(mockPush).not.toHaveBeenCalled();
  });
});
