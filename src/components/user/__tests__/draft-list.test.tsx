/** DraftList 组件测试：列表/空态/删除 */

import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const { mockUseDrafts } = vi.hoisted(() => ({ mockUseDrafts: vi.fn() }));
const { mockUseDeleteThread } = vi.hoisted(() => ({
  mockUseDeleteThread: vi.fn(),
}));

vi.mock("@/api/hooks/use-drafts", () => ({
  useDrafts: () => mockUseDrafts(),
}));

vi.mock("@/api/hooks/use-delete-thread", () => ({
  useDeleteThread: () => mockUseDeleteThread(),
}));

vi.mock("@tanstack/react-query", async () => {
  const actual = await vi.importActual("@tanstack/react-query");
  return {
    ...actual,
    useQueryClient: () => ({ invalidateQueries: vi.fn().mockResolvedValue(undefined) }),
  };
});

vi.mock("next/link", () => ({
  default: ({ children, href, ...props }: { children: React.ReactNode; href: string }) => (
    <a href={href} {...props}>{children}</a>
  ),
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock("@/components/thread/thread-categories-provider", () => ({
  useThreadCategoriesContext: () => ({
    categories: [{ id: "deduction", slug: "DEDUCTION", name: "演绎", color: null }],
  }),
}));

import { toast } from "sonner";
import { DraftList } from "@/components/user/draft-list";

function renderWithQC(ui: React.ReactElement) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
}

const sampleDraft = {
  id: "d1",
  title: "我的草稿",
  category: "RPG",
  status: "RECRUITING",
  visibility: "PUBLIC",
  published: false,
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-01T00:00:00Z",
  deletedAt: null,
  defaultSubthreadId: "s1",
  defaultSubthread: { id: "s1", title: "我的草稿" },
  topicTags: [],
  _count: { subthreads: 1, posts: 0 },
};

describe("DraftList", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseDeleteThread.mockReturnValue({
      isPending: false,
      mutateAsync: vi.fn().mockResolvedValue(undefined),
    });
    vi.stubGlobal("confirm", vi.fn(() => true));
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  test("空列表显示空状态", () => {
    mockUseDrafts.mockReturnValue({
      data: [],
      isLoading: false,
      error: undefined,
      refetch: vi.fn(),
    });
    renderWithQC(<DraftList />);
    expect(screen.getByText("还没有主题帖草稿")).toBeInTheDocument();
    expect(screen.queryByText("点击「新建主题帖」创建草稿。")).not.toBeInTheDocument();
  });

  test("渲染草稿并跳转编辑", () => {
    mockUseDrafts.mockReturnValue({
      data: [{ ...sampleDraft, category: "DEDUCTION" }],
      isLoading: false,
      error: undefined,
      refetch: vi.fn(),
    });
    renderWithQC(<DraftList />);
    expect(screen.getByText("我的草稿")).toBeInTheDocument();
    expect(screen.getByText("演绎")).toBeInTheDocument();
    expect(screen.queryByText("DEDUCTION")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "继续编辑" })).toHaveAttribute(
      "href",
      "/threads/d1/edit",
    );
  });

  test("删除草稿：confirm 确认后调用删除并提示", async () => {
    const user = userEvent.setup();
    const deleteMutate = vi.fn().mockResolvedValue(undefined);
    mockUseDeleteThread.mockReturnValue({
      isPending: false,
      mutateAsync: deleteMutate,
    });
    mockUseDrafts.mockReturnValue({
      data: [sampleDraft],
      isLoading: false,
      error: undefined,
      refetch: vi.fn(),
    });

    renderWithQC(<DraftList />);
    const deleteBtn = screen
      .getAllByRole("button")
      .find((b) => !b.textContent?.trim());
    expect(deleteBtn).toBeTruthy();
    if (deleteBtn) await user.click(deleteBtn);

    expect(global.confirm).toHaveBeenCalled();
    expect(deleteMutate).toHaveBeenCalledWith("d1");
    expect(toast.success).toHaveBeenCalledWith("草稿已删除");
  });
});
