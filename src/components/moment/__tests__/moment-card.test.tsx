import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const {
  mockPush,
  mockLike,
  mockBookmark,
  mockUseAuth,
  mockToastError,
  mockLikePending,
  mockMarkReturn,
} = vi.hoisted(() => ({
  mockPush: vi.fn(),
  mockLike: vi.fn(),
  mockBookmark: vi.fn(),
  mockUseAuth: vi.fn(),
  mockToastError: vi.fn(),
  mockLikePending: vi.fn(),
  mockMarkReturn: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
  usePathname: () => "/moments",
}));
vi.mock("next/link", () => ({
  default: ({
    children,
    href,
    onNavigate,
    ...props
  }: {
    children: React.ReactNode;
    href: string;
    onNavigate?: () => void;
  }) => (
    <a
      href={href}
      onClick={(event) => {
        event.preventDefault();
        onNavigate?.();
      }}
      {...props}
    >
      {children}
    </a>
  ),
}));
vi.mock("@/lib/moment-navigation", () => ({ markMomentFeedReturn: mockMarkReturn }));
vi.mock("@/lib/auth", () => ({ useAuth: () => mockUseAuth() }));
vi.mock("@/api/hooks/use-moments", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/api/hooks/use-moments")>();
  return {
    ...actual,
    useMomentLike: () => ({ mutateAsync: mockLike, isPending: mockLikePending() }),
    useMomentBookmark: () => ({ mutateAsync: mockBookmark, isPending: false }),
  };
});
vi.mock("sonner", () => ({ toast: { error: mockToastError } }));
vi.mock("@/components/economy/wenyou-tip-button", () => ({
  WenyouTipButton: () => <button type="button">加油</button>,
}));

import { MomentCard } from "@/components/moment/moment-card";

const moment = {
  id: "moment-1",
  authorId: "author-1",
  author: { id: "author-1", username: "作者", avatar: null, level: 1, deletedAt: null },
  title: "动态标题",
  contentExcerpt: "一段普通文字正文",
  coverType: "TEXT" as const,
  coverMedia: null,
  textCoverTheme: "ROSE" as const,
  imageCount: 0,
  likeCount: 2,
  commentCount: 3,
  bookmarkCount: 4,
  tipTotal: "5",
  viewerLiked: false,
  viewerBookmarked: false,
  createdAt: "2026-08-08T12:00:00.000Z",
  updatedAt: "2026-08-08T12:00:00.000Z",
};

describe("MomentCard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseAuth.mockReturnValue({ user: { id: "viewer-1" } });
    mockLike.mockResolvedValue({});
    mockBookmark.mockResolvedValue({});
    mockLikePending.mockReturnValue(false);
  });
  afterEach(cleanup);

  test("列表只展示竖版封面、标题、作者和点赞", async () => {
    render(<MomentCard moment={moment as never} />);

    const detailLink = screen.getByRole("link", { name: /动态标题/ });
    expect(detailLink).toHaveAttribute("href", "/moments/moment-1");
    fireEvent.click(detailLink);
    expect(mockMarkReturn).toHaveBeenCalledWith("moment-1", "/moments");
    expect(screen.queryByText("一段普通文字正文")).toBeNull();
    expect(screen.queryByText("5 升")).toBeNull();
    expect(screen.queryByRole("button", { name: /收藏/ })).toBeNull();
    expect(screen.queryByRole("button", { name: "加油" })).toBeNull();
    const likeButton = screen.getByRole("button", { name: "点赞" });
    expect(likeButton).toHaveAccessibleDescription("当前 2 个赞");
    fireEvent.click(likeButton);
    await waitFor(() => expect(mockLike).toHaveBeenCalledTimes(1));
    expect(mockBookmark).not.toHaveBeenCalled();
  });

  test("访客操作先跳转登录，并呈现已点赞状态", () => {
    mockUseAuth.mockReturnValue({ user: null });
    const { rerender } = render(<MomentCard moment={moment as never} />);
    fireEvent.click(screen.getByRole("button", { name: "点赞" }));
    expect(mockPush).toHaveBeenCalledWith("/login?next=%2Fmoments");
    expect(mockLike).not.toHaveBeenCalled();

    mockUseAuth.mockReturnValue({ user: { id: "author-1" } });
    rerender(<MomentCard moment={{ ...moment, viewerLiked: true, viewerBookmarked: true } as never} />);
    const likeButton = screen.getByRole("button", { name: "点赞" });
    expect(likeButton).toHaveAttribute("aria-pressed", "true");
    expect(likeButton).toHaveAccessibleDescription("当前 2 个赞");
    expect(likeButton).toHaveClass("bg-transparent", "text-foreground");
    expect(likeButton).not.toHaveClass("bg-like-soft");
    expect(likeButton).not.toHaveClass("text-destructive", "text-brand-strong");
    expect(likeButton.querySelector('[data-slot="interaction-toggle-icon"]'))
      .toHaveClass("text-like");
    expect(likeButton.querySelector('[data-slot="interaction-toggle-icon"]'))
      .toHaveAttribute("data-icon-variant", "filled");
  });

  test("接口失败显示明确错误", async () => {
    mockLike.mockRejectedValue(new Error("offline"));
    render(<MomentCard moment={moment as never} />);
    fireEvent.click(screen.getByRole("button", { name: "点赞" }));
    await waitFor(() => expect(mockToastError).toHaveBeenCalled());
  });

  test("点赞请求中保持原视觉，只阻止重复操作", () => {
    mockLikePending.mockReturnValue(true);
    render(<MomentCard moment={moment as never} />);

    const button = screen.getByRole("button", { name: "点赞" });
    expect(button).toHaveAttribute("aria-disabled", "true");
    expect(button).toHaveAttribute("aria-busy", "true");
    expect(button).not.toBeDisabled();
    expect(button.querySelector('[data-slot="interaction-toggle-icon"]')).toHaveClass(
      "transition-[color,fill]",
      "animate-spin",
    );
  });
});
