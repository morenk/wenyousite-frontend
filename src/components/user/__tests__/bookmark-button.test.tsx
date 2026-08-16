/** BookmarkButton 组件测试：收藏/取消切换 */

import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const { mockUseBookmarkActions } = vi.hoisted(() => ({
  mockUseBookmarkActions: vi.fn(),
}));

vi.mock("@/api/hooks/use-bookmark-actions", () => ({
  useBookmarkActions: () => mockUseBookmarkActions(),
}));

vi.mock("@tanstack/react-query", async () => {
  const actual = await vi.importActual("@tanstack/react-query");
  return {
    ...actual,
    useQueryClient: () => ({ invalidateQueries: vi.fn().mockResolvedValue(undefined) }),
  };
});

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

import { toast } from "sonner";
import { BookmarkButton } from "@/components/user/bookmark-button";

function renderWithQC(ui: React.ReactElement) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
}

describe("BookmarkButton", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseBookmarkActions.mockReturnValue({
      add: { isPending: false, mutateAsync: vi.fn().mockResolvedValue(undefined) },
      remove: { isPending: false, mutateAsync: vi.fn().mockResolvedValue(undefined) },
    });
  });

  afterEach(() => cleanup());

  test("未收藏显示「收藏」，点击调用 add", async () => {
    const user = userEvent.setup();
    const addMutate = vi.fn().mockResolvedValue(undefined);
    mockUseBookmarkActions.mockReturnValue({
      add: { isPending: false, mutateAsync: addMutate },
      remove: { isPending: false, mutateAsync: vi.fn() },
    });

    renderWithQC(<BookmarkButton threadId="t1" isBookmarked={false} bookmarkId={null} />);
    const btn = screen.getByRole("button", { name: "收藏" });
    await user.click(btn);

    expect(addMutate).toHaveBeenCalled();
    expect(toast.success).toHaveBeenCalledWith("已收藏");
  });

  test("已收藏显示「已收藏」，点击调用 remove(bookmarkId)", async () => {
    const user = userEvent.setup();
    const removeMutate = vi.fn().mockResolvedValue(undefined);
    mockUseBookmarkActions.mockReturnValue({
      add: { isPending: false, mutateAsync: vi.fn() },
      remove: { isPending: false, mutateAsync: removeMutate },
    });

    renderWithQC(<BookmarkButton threadId="t1" isBookmarked={true} bookmarkId="bm1" />);
    const btn = screen.getByRole("button", { name: "收藏" });
    expect(btn).toHaveTextContent("已收藏");
    expect(btn).toHaveAttribute("aria-pressed", "true");
    expect(btn).toHaveClass("bg-bookmark-soft", "text-foreground");
    expect(btn.querySelector('[data-slot="interaction-toggle-icon"]'))
      .toHaveClass("fill-bookmark", "text-bookmark");
    await user.click(btn);

    expect(removeMutate).toHaveBeenCalledWith("bm1");
    expect(toast.success).toHaveBeenCalledWith("已取消收藏");
  });
});
