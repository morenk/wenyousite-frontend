import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const {
  mockUseAuth,
  mockUsePathname,
  mockUseUserProfile,
  mockRefetch,
  mockReadContext,
} = vi.hoisted(() => ({
  mockUseAuth: vi.fn(),
  mockUsePathname: vi.fn(),
  mockUseUserProfile: vi.fn(),
  mockRefetch: vi.fn(),
  mockReadContext: vi.fn(),
}));

vi.mock("next/navigation", () => ({ usePathname: () => mockUsePathname() }));
vi.mock("@/lib/auth", () => ({ useAuth: () => mockUseAuth() }));
vi.mock("@/api/hooks/use-user-profile", () => ({
  useUserProfile: (...args: unknown[]) => mockUseUserProfile(...args),
}));
vi.mock("@/components/user/user-profile-card", () => ({
  UserProfileCard: () => <div data-testid="profile-header">共享资料头部</div>,
}));
vi.mock("@/components/layout/page-route-fallback", () => ({
  PageRouteFallback: () => <div>资料加载中</div>,
}));

import {
  UserProfileShell,
  useUserProfilePageContext,
} from "@/components/user/user-profile-shell";

const profile = {
  id: "author-1",
  username: "阿青",
  showRecentReplies: false,
  showPlayerBadges: false,
  showBookmarks: false,
  isDeactivated: false,
};

function ContextReader() {
  mockReadContext(useUserProfilePageContext());
  return <div>本人内容</div>;
}

describe("UserProfileShell", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUsePathname.mockReturnValue("/users/author-1/moments");
    mockUseAuth.mockReturnValue({ user: { id: "viewer-1" } });
    mockUseUserProfile.mockReturnValue({
      data: profile,
      isLoading: false,
      error: null,
      refetch: mockRefetch,
    });
  });

  afterEach(cleanup);

  test("共享资料头部并根据当前路由标记 Tab", () => {
    render(
      <UserProfileShell userId="author-1">
        <div>动态内容</div>
      </UserProfileShell>,
    );

    expect(screen.getByText("共享资料头部")).toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: "个人资料分类" })).toHaveClass("sticky");
    expect(screen.getByRole("link", { name: "概览" })).toHaveAttribute("href", "/users/author-1");
    expect(screen.getByRole("link", { name: "动态" })).toHaveAttribute(
      "href",
      "/users/author-1/moments",
    );
    expect(screen.getByRole("link", { name: "动态" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "帖子" })).toHaveAttribute(
      "href",
      "/users/author-1/threads",
    );
    expect(screen.queryByRole("link", { name: "收藏" })).not.toBeInTheDocument();
  });

  test("Tab 内容切换时保留同一个资料头部节点", () => {
    const { rerender } = render(
      <UserProfileShell userId="author-1">
        <div>动态内容</div>
      </UserProfileShell>,
    );
    const profileHeader = screen.getByTestId("profile-header");

    mockUsePathname.mockReturnValue("/users/author-1/threads");
    rerender(
      <UserProfileShell userId="author-1">
        <div>帖子内容</div>
      </UserProfileShell>,
    );

    expect(screen.getByTestId("profile-header")).toBe(profileHeader);
    expect(screen.getByRole("link", { name: "帖子" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByText("帖子内容")).toBeInTheDocument();
  });

  test("本人始终看到隐私 Tab，并通过共享上下文提供查看权限", () => {
    mockUseAuth.mockReturnValue({ user: { id: "author-1" } });
    mockUsePathname.mockReturnValue("/users/author-1/bookmarks");

    render(
      <UserProfileShell userId="author-1">
        <ContextReader />
      </UserProfileShell>,
    );

    expect(screen.getByRole("link", { name: "收藏" })).toHaveAttribute(
      "href",
      "/users/author-1/bookmarks",
    );
    expect(screen.getByRole("link", { name: "收藏" })).toHaveAttribute("aria-current", "page");
    expect(mockReadContext).toHaveBeenCalledWith(expect.objectContaining({
      isSelf: true,
      canViewRecentReplies: true,
      canViewPlayedThreads: true,
      canViewBookmarks: true,
    }));
  });

  test("加载、错误和注销状态不挂载 Tab 内容", () => {
    const TabContent = vi.fn(() => <div>不应出现</div>);
    mockUseUserProfile.mockReturnValueOnce({ data: undefined, isLoading: true });
    const { rerender } = render(
      <UserProfileShell userId="author-1"><TabContent /></UserProfileShell>,
    );
    expect(screen.getByText("资料加载中")).toBeInTheDocument();
    expect(TabContent).not.toHaveBeenCalled();

    mockUseUserProfile.mockReturnValueOnce({
      data: undefined,
      isLoading: false,
      error: new Error("offline"),
      refetch: mockRefetch,
    });
    rerender(<UserProfileShell userId="author-1"><TabContent /></UserProfileShell>);
    fireEvent.click(screen.getByRole("button", { name: "重试" }));
    expect(mockRefetch).toHaveBeenCalledOnce();

    mockUseUserProfile.mockReturnValueOnce({
      data: { id: "author-1", username: "已注销用户", isDeactivated: true },
      isLoading: false,
      error: null,
      refetch: mockRefetch,
    });
    rerender(<UserProfileShell userId="author-1"><TabContent /></UserProfileShell>);
    expect(screen.getByText("已注销用户")).toBeInTheDocument();
    expect(TabContent).not.toHaveBeenCalled();
  });
});
