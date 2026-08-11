/** UserProfileCard 组件测试：资料展示 + 本人/他人操作区分 */

import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const { mockUseAuth } = vi.hoisted(() => ({ mockUseAuth: vi.fn() }));

vi.mock("@/lib/auth", () => ({
  useAuth: () => mockUseAuth(),
}));

vi.mock("@/components/user/follow-button", () => ({
  FollowButton: ({ userId, isFollowing }: { userId: string; isFollowing: boolean }) => (
    <span data-testid="follow-btn">{userId}:{String(isFollowing)}</span>
  ),
}));

vi.mock("@/components/user/block-button", () => ({
  BlockButton: ({ userId, isBlocked }: { userId: string; isBlocked: boolean }) => (
    <span data-testid="block-btn">{userId}:{String(isBlocked)}</span>
  ),
}));

vi.mock("next/link", () => ({
  default: ({ children, href, ...props }: { children: React.ReactNode; href: string }) => (
    <a href={href} {...props}>{children}</a>
  ),
}));

import { UserProfileCard } from "@/components/user/user-profile-card";

function renderWithQC(ui: React.ReactElement) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
}

const sampleUser = {
  id: "u2",
  username: "testuser",
  avatar: null,
  bio: "你好",
  role: "USER" as const,
  level: 3,
  receivedTipTotal: "12",
  receivedTipCount: 2,
  showRecentReplies: true,
  showPlayerBadges: true,
  showBookmarks: true,
  accountStatus: "ACTIVE" as const,
  createdAt: "2026-01-01T00:00:00Z",
  _count: { following: 3, followers: 5 },
  isFollowing: false,
  isBlocked: false,
};

describe("UserProfileCard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseAuth.mockReturnValue({ user: { id: "u1" } });
  });

  afterEach(() => cleanup());

  test("渲染用户名、Bio、关注粉丝数", () => {
    renderWithQC(<UserProfileCard user={sampleUser} />);
    expect(screen.getByText("testuser")).toBeInTheDocument();
    expect(screen.getByText("你好")).toBeInTheDocument();
    expect(screen.getByText("关注 3")).toBeInTheDocument();
    expect(screen.getByText("粉丝 5")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /关注 3/ })).toHaveAttribute(
      "href",
      "/users/u2/following",
    );
    expect(screen.getByRole("link", { name: /粉丝 5/ })).toHaveAttribute(
      "href",
      "/users/u2/followers",
    );
  });

  test("查看他人时显示关注/拉黑按钮", () => {
    renderWithQC(<UserProfileCard user={sampleUser} />);
    expect(screen.getByText("获得 12 升 · 2 次")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "加油" })).not.toHaveClass("bg-primary");
    expect(screen.getByRole("button", { name: "加油" })).not.toHaveClass("border-border");
    const messageLink = screen.getByRole("link", { name: "私聊" });
    expect(messageLink).toHaveAttribute(
      "href",
      "/messages/new/u2",
    );
    expect(messageLink).not.toHaveClass("bg-primary");
    expect(messageLink).not.toHaveClass("border-border");
    expect(screen.getByTestId("follow-btn")).toHaveTextContent("u2:false");
    expect(screen.getByTestId("block-btn")).toHaveTextContent("u2:false");
  });

  test("查看自己时显示「编辑资料」而非关注按钮", () => {
    mockUseAuth.mockReturnValue({ user: { id: "u2" } });
    renderWithQC(<UserProfileCard user={sampleUser} />);
    expect(screen.getByRole("link", { name: "编辑资料" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "加油" })).not.toBeInTheDocument();
    expect(screen.queryByTestId("follow-btn")).not.toBeInTheDocument();
  });

  test("访客查看他人资料时不显示投入入口", () => {
    mockUseAuth.mockReturnValue({ user: null });
    renderWithQC(<UserProfileCard user={sampleUser} />);
    expect(screen.queryByRole("button", { name: "加油" })).not.toBeInTheDocument();
  });

  test.each([
    ["SUSPENDED", "该用户已被暂时封禁"],
    ["BANNED", "该用户已被永久封禁"],
  ] as const)("根据账号状态显示封禁提示且不展示截止时间", (accountStatus, message) => {
    renderWithQC(<UserProfileCard user={{ ...sampleUser, accountStatus }} />);
    expect(screen.getByRole("status")).toHaveTextContent(message);
    expect(screen.getByRole("status")).not.toHaveTextContent(/至|截止|\d{4}-\d{2}-\d{2}/);
  });
});
