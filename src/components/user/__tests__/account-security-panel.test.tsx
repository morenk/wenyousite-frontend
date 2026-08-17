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
    { id: "current", platform: "web", deviceInfo: "Mozilla/5.0 raw-web-ua", isCurrent: true, signedInAt: "2026-08-01T00:00:00Z", lastActiveAt: "2026-08-01T01:00:00Z", createdAt: "2026-08-01T00:00:00Z", expiresAt: "2026-08-08T00:00:00Z" },
    { id: "remote", platform: "mobile", deviceInfo: "Dart/3 raw-mobile-ua", isCurrent: false, signedInAt: "2026-08-02T00:00:00Z", lastActiveAt: "2026-08-02T01:00:00Z", createdAt: "2026-08-02T00:00:00Z", expiresAt: "2026-09-01T00:00:00Z" },
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

vi.mock("@/lib/auth", () => ({ useAuth: () => ({ logout, user: { id: "u1" } }) }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace, refresh }) }));
vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) => <a href={href}>{children}</a>,
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { toast } from "sonner";

beforeEach(() => {
  sessionQuery.data = [
    { id: "current", platform: "web", deviceInfo: "Mozilla/5.0 raw-web-ua", isCurrent: true, signedInAt: "2026-08-01T00:00:00Z", lastActiveAt: "2026-08-01T01:00:00Z", createdAt: "2026-08-01T00:00:00Z", expiresAt: "2026-08-08T00:00:00Z" },
    { id: "remote", platform: "mobile", deviceInfo: "Dart/3 raw-mobile-ua", isCurrent: false, signedInAt: "2026-08-02T00:00:00Z", lastActiveAt: "2026-08-02T01:00:00Z", createdAt: "2026-08-02T00:00:00Z", expiresAt: "2026-09-01T00:00:00Z" },
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
  test("以友好终端文案展示双端登录且不泄露原始 UA", async () => {
    const user = userEvent.setup();
    render(<AccountSecurityPanel />);

    expect(screen.getByText("Web 端登录")).toBeInTheDocument();
    expect(screen.getByText("移动端登录")).toBeInTheDocument();
    expect(screen.getByText("当前终端")).toBeInTheDocument();
    expect(screen.queryByText(/Mozilla\/5\.0/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Dart\/3/)).not.toBeInTheDocument();
    expect(screen.getByText("用户二")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "退出登录" }));
    await user.click(screen.getByRole("button", { name: "取消拉黑" }));
    expect(revokeMutate).toHaveBeenCalledWith("remote");
    expect(unblockMutate).toHaveBeenCalledWith("u2");
    expect(toast.success).not.toHaveBeenCalledWith("已取消拉黑");
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
    expect(screen.queryByText("登录终端加载失败")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "重新加载" }));
    expect(sessionQuery.refetch).toHaveBeenCalledTimes(1);
  });

  test("旧后端缺少新时间字段时回退到 createdAt", () => {
    sessionQuery.data = [{
      id: "legacy",
      platform: "web",
      deviceInfo: "legacy raw UA",
      isCurrent: true,
      createdAt: "2026-08-03T02:04:00Z",
      expiresAt: "2026-08-10T02:04:00Z",
    }];

    render(<AccountSecurityPanel />);

    const session = screen.getByText("Web 端登录").closest("li");
    const times = session?.querySelectorAll("time") ?? [];
    expect(times).toHaveLength(3);
    expect(times[0]).toHaveAttribute("datetime", "2026-08-03T02:04:00Z");
    expect(times[1]).toHaveAttribute("datetime", "2026-08-03T02:04:00Z");
    expect(screen.queryByText(/legacy raw UA/)).not.toBeInTheDocument();
  });
});
