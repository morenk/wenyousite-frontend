/** BlockButton 组件测试：confirm 确认 + 拉黑/取消切换 */

import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, act, within, waitFor } from "@testing-library/react";
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
import { ConfirmProvider } from "@/components/ui/confirm-provider";
import { setAuthSession, clearAuthSession } from "@/lib/auth-store";
const actor = { id: "u1", username: "本人", email: "me@example.test", role: "USER", avatar: null };
import { BlockButton } from "@/components/user/block-button";

function renderWithQC(ui: React.ReactElement) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
}

describe("BlockButton", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setAuthSession(actor, "test-token");
    mockUseAuth.mockReturnValue({ user: { id: "u1" } });
    mockUseBlockActions.mockReturnValue({
      block: { isPending: false, mutateAsync: vi.fn().mockResolvedValue(undefined) },
      unblock: { isPending: false, mutateAsync: vi.fn().mockResolvedValue(undefined) },
    });
    vi.stubGlobal("confirm", vi.fn(() => true));
  });

  afterEach(() => {
    cleanup();
    clearAuthSession();
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
    expect(toast.success).not.toHaveBeenCalled();
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
    expect(toast.success).not.toHaveBeenCalled();
  });

  test("拉黑失败时保留错误提示", async () => {
    const user = userEvent.setup();
    mockUseBlockActions.mockReturnValue({
      block: { isPending: false, mutateAsync: vi.fn().mockRejectedValue(new Error("操作被拒绝")) },
      unblock: { isPending: false, mutateAsync: vi.fn() },
    });

    renderWithQC(<BlockButton userId="u2" isBlocked={false} />);
    await user.click(screen.getByRole("button", { name: "拉黑" }));

    expect(toast.error).toHaveBeenCalledWith("操作被拒绝");
  });
});


test.each(["account", "account-return", "target", "unmount"])("旧拉黑确认在%s失效后不能提交", async (change) => {
  setAuthSession(actor, "test-token");
  mockUseAuth.mockReturnValue({ user: actor });
  const block = vi.fn();
  mockUseBlockActions.mockReturnValue({ block: { mutateAsync: block, isPending: false }, unblock: { isPending: false } });
  const view = render(<ConfirmProvider><BlockButton userId="u2" isBlocked={false} /></ConfirmProvider>);
  const person = userEvent.setup();
  await person.click(screen.getByRole("button", { name: "拉黑" }));
  const dialog = await screen.findByRole("alertdialog");
  if (change === "account") act(() => { clearAuthSession(); setAuthSession(actor, "new-session"); });
  if (change === "account-return") act(() => { setAuthSession({ ...actor, id: "another-viewer" }, "other-session"); setAuthSession(actor, "returned-session"); });
  if (change === "target") view.rerender(<ConfirmProvider><BlockButton userId="u3" isBlocked={false} /></ConfirmProvider>);
  if (change === "unmount") view.rerender(<ConfirmProvider><span>已离开资料</span></ConfirmProvider>);
  await person.click(within(dialog).getByRole("button", { name: "拉黑" }));
  await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
  expect(block).not.toHaveBeenCalled();
  cleanup(); clearAuthSession();
});
test("未知结果复用只读核实而不打开拉黑确认", async () => {
  setAuthSession(actor, "test-token");
  mockUseAuth.mockReturnValue({ user: actor });
  const reconcile = vi.fn().mockResolvedValue(undefined);
  const block = vi.fn();
  mockUseBlockActions.mockReturnValue({ block: { mutateAsync: block, isPending: false }, unblock: { isPending: false }, needsReconciliation: true, reconcile: { mutateAsync: reconcile } });
  render(<ConfirmProvider><BlockButton userId="u2" isBlocked={false} /></ConfirmProvider>);
  await userEvent.setup().click(screen.getByRole("button", { name: "刷新核实" }));
  expect(reconcile).toHaveBeenCalledOnce();
  expect(block).not.toHaveBeenCalled();
  expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  cleanup(); clearAuthSession();
});
