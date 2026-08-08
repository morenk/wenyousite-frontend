/** FollowButton 组件测试：登录显隐 + 关注/取消切换 */

import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const { mockUseAuth } = vi.hoisted(() => ({ mockUseAuth: vi.fn() }));
const { mockUseFollowActions } = vi.hoisted(() => ({
  mockUseFollowActions: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  useAuth: () => mockUseAuth(),
}));

vi.mock("@/api/hooks/use-follow-actions", () => ({
  useFollowActions: () => mockUseFollowActions(),
}));

vi.mock("@tanstack/react-query", async () => {
  const actual = await vi.importActual("@tanstack/react-query");
  return {
    ...actual,
    useQueryClient: () => ({ invalidateQueries: vi.fn() }),
  };
});

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

import { toast } from "sonner";
import { FollowButton } from "@/components/user/follow-button";

function renderWithQC(ui: React.ReactElement) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
}

describe("FollowButton", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseFollowActions.mockReturnValue({
      follow: { isPending: false, mutateAsync: vi.fn().mockResolvedValue(undefined) },
      unfollow: { isPending: false, mutateAsync: vi.fn().mockResolvedValue(undefined) },
    });
  });

  afterEach(() => cleanup());

  test("未登录不显示按钮", () => {
    mockUseAuth.mockReturnValue({ user: null });
    renderWithQC(<FollowButton userId="u2" isFollowing={false} />);
    expect(screen.queryByRole("button", { name: "关注" })).not.toBeInTheDocument();
  });

  test("未关注时显示「关注」，点击后调用 follow", async () => {
    const user = userEvent.setup();
    mockUseAuth.mockReturnValue({ user: { id: "u1" } });
    const followMutate = vi.fn().mockResolvedValue(undefined);
    mockUseFollowActions.mockReturnValue({
      follow: { isPending: false, mutateAsync: followMutate },
      unfollow: { isPending: false, mutateAsync: vi.fn() },
    });

    renderWithQC(<FollowButton userId="u2" isFollowing={false} />);
    const btn = screen.getByRole("button", { name: "关注" });
    expect(btn).not.toHaveClass("bg-primary");
    expect(btn).not.toHaveClass("border-border");
    await user.click(btn);

    expect(followMutate).toHaveBeenCalled();
    expect(toast.success).toHaveBeenCalledWith("关注成功");
  });

  test("已关注时显示「已关注」，点击后调用 unfollow", async () => {
    const user = userEvent.setup();
    mockUseAuth.mockReturnValue({ user: { id: "u1" } });
    const unfollowMutate = vi.fn().mockResolvedValue(undefined);
    mockUseFollowActions.mockReturnValue({
      follow: { isPending: false, mutateAsync: vi.fn() },
      unfollow: { isPending: false, mutateAsync: unfollowMutate },
    });

    renderWithQC(<FollowButton userId="u2" isFollowing={true} />);
    const btn = screen.getByRole("button", { name: "已关注" });
    expect(btn).not.toHaveClass("bg-primary");
    expect(btn).not.toHaveClass("border-border");
    await user.click(btn);

    expect(unfollowMutate).toHaveBeenCalled();
    expect(toast.success).toHaveBeenCalledWith("已取消关注");
  });
});
