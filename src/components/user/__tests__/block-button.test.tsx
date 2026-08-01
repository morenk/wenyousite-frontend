/** BlockButton 组件测试：confirm 确认 + 拉黑/取消切换 */

import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const { mockUseAuth } = vi.hoisted(() => ({ mockUseAuth: vi.fn() }));
const { mockUseBlockActions } = vi.hoisted(() => ({
  mockUseBlockActions: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  useAuth: () => mockUseAuth(),
}));

vi.mock("@/api/hooks/use-block-actions", () => ({
  useBlockActions: () => mockUseBlockActions(),
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
import { BlockButton } from "@/components/user/block-button";

function renderWithQC(ui: React.ReactElement) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
}

describe("BlockButton", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseAuth.mockReturnValue({ user: { id: "u1" } });
    mockUseBlockActions.mockReturnValue({
      block: { isPending: false, mutateAsync: vi.fn().mockResolvedValue(undefined) },
      unblock: { isPending: false, mutateAsync: vi.fn().mockResolvedValue(undefined) },
    });
    vi.stubGlobal("confirm", vi.fn(() => true));
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  test("未登录不显示按钮", () => {
    mockUseAuth.mockReturnValue({ user: null });
    renderWithQC(<BlockButton userId="u2" isBlocked={false} />);
    expect(screen.queryByRole("button", { name: "拉黑" })).not.toBeInTheDocument();
  });

  test("点击拉黑需 confirm 确认", async () => {
    const user = userEvent.setup();
    const blockMutate = vi.fn().mockResolvedValue(undefined);
    mockUseBlockActions.mockReturnValue({
      block: { isPending: false, mutateAsync: blockMutate },
      unblock: { isPending: false, mutateAsync: vi.fn() },
    });

    renderWithQC(<BlockButton userId="u2" isBlocked={false} />);
    await user.click(screen.getByRole("button", { name: "拉黑" }));

    expect(global.confirm).toHaveBeenCalled();
    expect(blockMutate).toHaveBeenCalled();
    expect(toast.success).toHaveBeenCalledWith("已拉黑");
  });

  test("confirm 取消时不执行拉黑", async () => {
    const user = userEvent.setup();
    vi.stubGlobal("confirm", vi.fn(() => false));
    const blockMutate = vi.fn();
    mockUseBlockActions.mockReturnValue({
      block: { isPending: false, mutateAsync: blockMutate },
      unblock: { isPending: false, mutateAsync: vi.fn() },
    });

    renderWithQC(<BlockButton userId="u2" isBlocked={false} />);
    await user.click(screen.getByRole("button", { name: "拉黑" }));

    expect(blockMutate).not.toHaveBeenCalled();
  });

  test("已拉黑时点击调用 unblock", async () => {
    const user = userEvent.setup();
    const unblockMutate = vi.fn().mockResolvedValue(undefined);
    mockUseBlockActions.mockReturnValue({
      block: { isPending: false, mutateAsync: vi.fn() },
      unblock: { isPending: false, mutateAsync: unblockMutate },
    });

    renderWithQC(<BlockButton userId="u2" isBlocked={true} />);
    await user.click(screen.getByRole("button", { name: "已拉黑" }));

    expect(unblockMutate).toHaveBeenCalled();
    expect(toast.success).toHaveBeenCalledWith("已取消拉黑");
  });
});
