/** UserFollowList 组件测试：三态 + 渲染 */

import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const { mockUseUserFollowList } = vi.hoisted(() => ({
  mockUseUserFollowList: vi.fn(),
}));

vi.mock("@/api/hooks/use-user-follow-list", () => ({
  useUserFollowList: () => mockUseUserFollowList(),
}));

vi.mock("next/link", () => ({
  default: ({ children, href, ...props }: { children: React.ReactNode; href: string }) => (
    <a href={href} {...props}>{children}</a>
  ),
}));

import { UserFollowList } from "@/components/user/user-follow-list";

afterEach(() => cleanup());
beforeEach(() => vi.clearAllMocks());

function createWrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
  }
  Wrapper.displayName = "QueryClientWrapper";
  return Wrapper;
}

describe("UserFollowList", () => {
  test("加载中显示 spinner", () => {
    mockUseUserFollowList.mockReturnValue({ data: undefined, isLoading: true, isError: false, refetch: vi.fn() });
    render(<UserFollowList userId="u1" kind="following" />, { wrapper: createWrapper() });
    expect(document.querySelector(".animate-spin")).toBeTruthy();
  });

  test("错误状态显示重试", () => {
    mockUseUserFollowList.mockReturnValue({ data: undefined, isLoading: false, isError: true, refetch: vi.fn() });
    render(<UserFollowList userId="u1" kind="following" />, { wrapper: createWrapper() });
    expect(screen.getByText("加载失败")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "重试" })).toBeInTheDocument();
  });

  test("关注列表空态文案", () => {
    mockUseUserFollowList.mockReturnValue({ data: [], isLoading: false, isError: false, refetch: vi.fn() });
    render(<UserFollowList userId="u1" kind="following" />, { wrapper: createWrapper() });
    expect(screen.getByText("还没有关注任何人")).toBeInTheDocument();
  });

  test("粉丝列表空态文案", () => {
    mockUseUserFollowList.mockReturnValue({ data: [], isLoading: false, isError: false, refetch: vi.fn() });
    render(<UserFollowList userId="u1" kind="followers" />, { wrapper: createWrapper() });
    expect(screen.getByText("还没有粉丝")).toBeInTheDocument();
  });

  test("渲染关注用户列表并链接到用户主页", () => {
    mockUseUserFollowList.mockReturnValue({
      data: [{ id: "u2", username: "morenk", avatar: null }],
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });
    render(<UserFollowList userId="u1" kind="following" />, { wrapper: createWrapper() });
    expect(screen.getByRole("link", { name: /morenk/ })).toHaveAttribute("href", "/users/u2");
  });
});
