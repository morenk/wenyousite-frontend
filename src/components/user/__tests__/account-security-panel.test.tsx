/** AccountSecurityPanel 组件测试 */

import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AccountSecurityPanel } from "@/components/user/account-security-panel";

const revokeMutate = vi.fn();
const unblockMutate = vi.fn();
const deleteMutate = vi.fn();
const logout = vi.fn();
const replace = vi.fn();
const refresh = vi.fn();
const sessionQuery = vi.hoisted(() => ({
  data: [
    { id: "current", platform: "web", deviceInfo: "当前 Chrome", isCurrent: true, createdAt: "2026-08-01T00:00:00Z", expiresAt: "2026-08-08T00:00:00Z" },
    { id: "remote", platform: "web", deviceInfo: "远程 Firefox", isCurrent: false, createdAt: "2026-08-01T00:00:00Z", expiresAt: "2026-08-08T00:00:00Z" },
  ] as Array<Record<string, unknown>>,
  isLoading: false,
  error: null as unknown,
  refetch: vi.fn(),
}));

vi.mock("@/api/hooks/use-account-security", () => ({
  useAccountSessions: () => sessionQuery,
  useBlockedUsers: () => ({
    data: [{ id: "block-1", blocked: { id: "u2", username: "用户二", avatar: null } }],
    isLoading: false,
    error: null,
  }),
  useRevokeSession: () => ({ mutateAsync: revokeMutate, isPending: false }),
  useUnblockUser: () => ({ mutateAsync: unblockMutate, isPending: false }),
  useDeleteAccount: () => ({ mutateAsync: deleteMutate, isPending: false }),
}));

vi.mock("@/lib/auth", () => ({ useAuth: () => ({ logout }) }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace, refresh }) }));
vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) => <a href={href}>{children}</a>,
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

beforeEach(() => {
  sessionQuery.data = [
    { id: "current", platform: "web", deviceInfo: "当前 Chrome", isCurrent: true, createdAt: "2026-08-01T00:00:00Z", expiresAt: "2026-08-08T00:00:00Z" },
    { id: "remote", platform: "web", deviceInfo: "远程 Firefox", isCurrent: false, createdAt: "2026-08-01T00:00:00Z", expiresAt: "2026-08-08T00:00:00Z" },
  ];
  sessionQuery.isLoading = false;
  sessionQuery.error = null;
  sessionQuery.refetch.mockReset();
  revokeMutate.mockReset().mockResolvedValue({});
  unblockMutate.mockReset().mockResolvedValue({});
  deleteMutate.mockReset().mockResolvedValue({});
  logout.mockReset();
  replace.mockReset();
  refresh.mockReset();
  vi.stubGlobal("confirm", vi.fn(() => true));
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("AccountSecurityPanel", () => {
  test("展示会话和黑名单，并执行撤销与取消拉黑", async () => {
    const user = userEvent.setup();
    render(<AccountSecurityPanel />);

    expect(screen.getByText("当前 Chrome")).toBeInTheDocument();
    expect(screen.getByText("用户二")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "远程登出" }));
    await user.click(screen.getByRole("button", { name: "取消拉黑" }));
    expect(revokeMutate).toHaveBeenCalledWith("remote");
    expect(unblockMutate).toHaveBeenCalledWith("u2");
  });

  test("必须输入确认文字才能注销账号", async () => {
    const user = userEvent.setup();
    render(<AccountSecurityPanel />);
    const button = screen.getByRole("button", { name: "永久注销" });
    expect(button).toBeDisabled();

    await user.type(screen.getByLabelText("注销确认文字"), "注销账号");
    expect(button).toBeEnabled();
    await user.click(button);

    expect(deleteMutate).toHaveBeenCalledTimes(1);
    expect(logout).toHaveBeenCalledTimes(1);
    expect(replace).toHaveBeenCalledWith("/");
  });

  test("429 时显示限流原因并支持手动重新加载", async () => {
    const user = userEvent.setup();
    sessionQuery.error = { code: 42900, message: "请求过于频繁" };
    render(<AccountSecurityPanel />);

    expect(screen.getByText("操作太频繁，请稍后再试")).toBeInTheDocument();
    expect(screen.queryByText("设备会话加载失败")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "重新加载" }));
    expect(sessionQuery.refetch).toHaveBeenCalledTimes(1);
  });
});
