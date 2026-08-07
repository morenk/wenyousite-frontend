import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { GuestOnly } from "@/components/auth/guest-only";

const {
  mockReplace,
  mockUseAuth,
  mockUsePathname,
  mockGetNext,
} = vi.hoisted(() => ({
  mockReplace: vi.fn(),
  mockUseAuth: vi.fn(),
  mockUsePathname: vi.fn(),
  mockGetNext: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: mockReplace }),
  usePathname: () => mockUsePathname(),
  useSearchParams: () => ({ get: mockGetNext }),
}));

vi.mock("@/lib/auth", () => ({ useAuth: () => mockUseAuth() }));
vi.mock("@/components/shared/loading-state", () => ({
  LoadingState: () => <div data-testid="guest-loading" />,
}));

beforeEach(() => {
  vi.clearAllMocks();
  mockUsePathname.mockReturnValue("/login");
  mockGetNext.mockReturnValue(null);
});

afterEach(() => cleanup());

describe("GuestOnly", () => {
  test("会话恢复前显示加载态", () => {
    mockUseAuth.mockReturnValue({ user: null, isInitialized: false });
    render(<GuestOnly><div>访客内容</div></GuestOnly>);

    expect(screen.getByTestId("guest-loading")).toBeInTheDocument();
    expect(screen.queryByText("访客内容")).not.toBeInTheDocument();
  });

  test("未登录且恢复完成时显示子内容", () => {
    mockUseAuth.mockReturnValue({ user: null, isInitialized: true });
    render(<GuestOnly><div>访客内容</div></GuestOnly>);

    expect(screen.getByText("访客内容")).toBeInTheDocument();
    expect(mockReplace).not.toHaveBeenCalled();
  });

  test("登录页已登录用户跳转到安全 next 路径", async () => {
    mockUseAuth.mockReturnValue({ user: { id: "u1" }, isInitialized: true });
    mockGetNext.mockReturnValue("/threads/t1?tab=posts");
    render(<GuestOnly><div>访客内容</div></GuestOnly>);

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith("/threads/t1?tab=posts");
    });
    expect(screen.getByTestId("guest-loading")).toBeInTheDocument();
  });

  test.each(["https://evil.example", "//evil.example", null])(
    "拒绝不安全 next=%s",
    async (next) => {
      mockUseAuth.mockReturnValue({ user: { id: "u1" }, isInitialized: true });
      mockGetNext.mockReturnValue(next);
      render(<GuestOnly><div>访客内容</div></GuestOnly>);
      await waitFor(() => expect(mockReplace).toHaveBeenCalledWith("/"));
      cleanup();
      mockReplace.mockClear();
    },
  );

  test("非登录访客页忽略 next 并回首页", async () => {
    mockUseAuth.mockReturnValue({ user: { id: "u1" }, isInitialized: true });
    mockUsePathname.mockReturnValue("/register");
    mockGetNext.mockReturnValue("/threads/t1");
    render(<GuestOnly><div>访客内容</div></GuestOnly>);

    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith("/"));
  });
});
