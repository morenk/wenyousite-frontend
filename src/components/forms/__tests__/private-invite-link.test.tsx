import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { PrivateInviteLink } from "../private-invite-link";
import { clearAuthSession, setAuthSession } from "@/lib/auth-store";
import { toast } from "sonner";

const mocks = vi.hoisted(() => ({ ensure: vi.fn(), reset: vi.fn(), clear: vi.fn(), path: "/threads/t1/edit", confirm: vi.fn() }));
vi.mock("next/navigation", () => ({ usePathname: () => mocks.path }));
vi.mock("@/components/ui/confirm-provider", () => ({ useConfirm: () => mocks.confirm }));
vi.mock("@/api/hooks/use-thread-access-actions", () => ({
  useEnsureInviteLink: () => ({ mutateAsync: mocks.ensure, reset: mocks.clear }),
  useCreateInviteLink: () => ({ mutateAsync: mocks.reset, reset: mocks.clear }),
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), message: vi.fn() } }));
function login(id = "owner") { setAuthSession({ id, email: `${id}@example.test`, username: id, avatar: null, role: "USER" }, "fake"); }
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (value: unknown) => void;
  const promise = new Promise<T>((ok, fail) => { resolve = ok; reject = fail; });
  return { promise, resolve, reject };
}
const element = (props = {}) => <PrivateInviteLink threadId="t1" ownerId="owner" disabled={false} {...props} />;
function setup(props = {}) {
  const user = userEvent.setup();
  const writeText = vi.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
  return { user, writeText, ...render(element(props)) };
}
beforeEach(() => {
  vi.resetAllMocks();
  mocks.path = "/threads/t1/edit";
  login();
  mocks.ensure.mockResolvedValue({ token: "current-link" });
  mocks.reset.mockResolvedValue({ token: "new-link" });
  mocks.confirm.mockResolvedValue(true);
});
afterEach(() => { cleanup(); clearAuthSession(); });

describe("私密邀请分享", () => {
  test("每次复制向服务端取得当前链接，重开也不要求本地保存", async () => {
    const { user, writeText, unmount } = setup();
    await user.click(screen.getByRole("button", { name: "复制邀请链接" }));
    await user.click(screen.getByRole("button", { name: "复制邀请链接" }));
    expect(mocks.ensure).toHaveBeenCalledTimes(2);
    expect(mocks.reset).not.toHaveBeenCalled();
    expect(mocks.confirm).not.toHaveBeenCalled();
    expect(writeText.mock.calls[0]).toEqual(writeText.mock.calls[1]);
    unmount();
    render(element());
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "复制邀请链接" }));
    expect(writeText.mock.calls[2]).toEqual(writeText.mock.calls[0]);
    expect(localStorage.getItem("invite-link")).toBeNull();
  });

  test("主动重置先说明旧链接失效但成员权限保留，成功后展示并复制", async () => {
    const { user, writeText } = setup();
    await user.click(screen.getByRole("button", { name: "重置邀请链接" }));
    expect(mocks.confirm).toHaveBeenCalledWith(expect.objectContaining({ description: "旧邀请链接将立即失效，已加入成员的权限不受影响。" }));
    expect(mocks.reset).toHaveBeenCalledExactlyOnceWith("t1");
    expect(mocks.ensure).not.toHaveBeenCalled();
    expect(screen.getByRole("textbox", { name: "当前邀请链接" })).toHaveValue(`${window.location.origin}/join/new-link`);
    expect(writeText).toHaveBeenCalledWith(expect.stringContaining("/join/new-link"));
  });

  test("取消重置保留当前可手动复制的链接", async () => {
    const { user } = setup();
    await user.click(screen.getByRole("button", { name: "复制邀请链接" }));
    mocks.confirm.mockResolvedValue(false);
    await user.click(screen.getByRole("button", { name: "重置邀请链接" }));
    expect(mocks.reset).not.toHaveBeenCalled();
    expect(screen.getByRole("textbox")).toHaveValue(`${window.location.origin}/join/current-link`);
  });

  test.each([false, true])("%s 重置场景的剪贴板失败与接口失败分开，保留手动复制", async (reset) => {
    const { user, writeText } = setup();
    writeText.mockRejectedValue(new Error("denied"));
    await user.click(screen.getByRole("button", { name: reset ? "重置邀请链接" : "复制邀请链接" }));
    expect(screen.getByRole("status")).toHaveTextContent("自动复制失败，请手动复制下方链接");
    expect(screen.getByRole("textbox")).toHaveValue(`${window.location.origin}/join/${reset ? "new-link" : "current-link"}`);
    expect(mocks.reset).toHaveBeenCalledTimes(reset ? 1 : 0);
    expect(toast.success).not.toHaveBeenCalled();
  });

  test.each([{ code: 40400, message: "接口不可用" }, new TypeError("offline")])("获取失败不自动调用重置，不保留旧凭据", async (error) => {
    const { user, writeText } = setup();
    await user.click(screen.getByRole("button", { name: "复制邀请链接" }));
    mocks.ensure.mockRejectedValue(error);
    await user.click(screen.getByRole("button", { name: "复制邀请链接" }));
    expect(mocks.reset).not.toHaveBeenCalled();
    expect(writeText).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("获取邀请链接失败");
  });

  test.each([new TypeError("lost"), { code: 50000 }, { code: 40101 }])("重置结果不明时只取回当前链接，不声称重置成功", async (error) => {
    mocks.reset.mockRejectedValue(error);
    const { user, writeText } = setup();
    await user.click(screen.getByRole("button", { name: "重置邀请链接" }));
    expect(mocks.reset).toHaveBeenCalledTimes(1);
    expect(mocks.ensure).toHaveBeenCalledExactlyOnceWith("t1");
    expect(writeText).toHaveBeenCalledWith(expect.stringContaining("current-link"));
    expect(screen.getByRole("status")).toHaveTextContent("重置结果未确认，已取回当前邀请链接");
    expect(toast.success).not.toHaveBeenCalled();
  });

  test("结果核实失败后引导复制重试，不保留旧链接", async () => {
    mocks.reset.mockRejectedValue(new TypeError("lost"));
    mocks.ensure.mockRejectedValue(new TypeError("offline"));
    const { user, writeText } = setup();
    await user.click(screen.getByRole("button", { name: "重置邀请链接" }));
    expect(mocks.reset).toHaveBeenCalledTimes(1);
    expect(writeText).not.toHaveBeenCalled();
    expect(screen.getByRole("status")).toHaveTextContent("请稍后点击“复制邀请链接”重试");
  });

  test("明确权限失败不发出额外获取请求", async () => {
    mocks.reset.mockRejectedValue({ code: 40302, message: "仅楼主可用" });
    const { user } = setup();
    await user.click(screen.getByRole("button", { name: "重置邀请链接" }));
    expect(mocks.ensure).not.toHaveBeenCalled();
    expect(screen.getByRole("status")).toHaveTextContent("重置邀请链接失败：仅楼主可用");
  });

  test("确认、请求和剪贴板全阶段防重复和复制重置冲突", async () => {
    const confirmation = deferred<boolean>();
    const request = deferred<{ token: string }>();
    const clipboard = deferred<void>();
    mocks.confirm.mockReturnValue(confirmation.promise);
    mocks.reset.mockReturnValue(request.promise);
    const { user, writeText } = setup();
    writeText.mockReturnValue(clipboard.promise);
    const reset = screen.getByRole("button", { name: "重置邀请链接" });
    const copy = screen.getByRole("button", { name: "复制邀请链接" });
    await user.click(reset);
    expect(reset).toBeDisabled(); expect(copy).toBeDisabled();
    fireEvent.click(reset); fireEvent.click(copy);
    await act(async () => { confirmation.resolve(true); });
    expect(reset).toBeDisabled(); expect(copy).toBeDisabled();
    await act(async () => { request.resolve({ token: "new-link" }); });
    expect(reset).toBeDisabled(); expect(copy).toBeDisabled();
    await act(async () => { clipboard.resolve(); });
    expect(reset).toBeEnabled(); expect(copy).toBeEnabled();
    expect(mocks.reset).toHaveBeenCalledTimes(1);
    expect(mocks.ensure).not.toHaveBeenCalled();
  });

  test.each(["unmount", "account", "route", "thread", "unavailable"])("等待响应时%s会使旧响应失效，不写剪贴板、不提示", async (change) => {
    const request = deferred<{ token: string }>();
    mocks.ensure.mockReturnValue(request.promise);
    const { user, writeText, unmount, rerender } = setup();
    await user.click(screen.getByRole("button", { name: "复制邀请链接" }));
    if (change === "unmount") unmount();
    if (change === "account") act(() => login("other"));
    if (change === "route") { mocks.path = "/threads/other/edit"; rerender(element()); }
    if (change === "thread") rerender(element({ threadId: "other" }));
    if (change === "unavailable") rerender(element({ unavailableReason: "请先保存可见性设置。" }));
    await act(async () => { request.resolve({ token: "late-secret" }); });
    expect(writeText).not.toHaveBeenCalled();
    expect(toast.success).not.toHaveBeenCalled();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  });

  test("切号后清理已显示的链接，重新登录不恢复凭据", async () => {
    const { user } = setup();
    await user.click(screen.getByRole("button", { name: "复制邀请链接" }));
    expect(screen.getByRole("textbox")).toBeInTheDocument();
    act(() => login("other"));
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    act(() => login());
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  });

  test("确认期间切号即使再切回也不发出旧重置", async () => {
    const confirmation = deferred<boolean>();
    mocks.confirm.mockReturnValue(confirmation.promise);
    const { user } = setup();
    await user.click(screen.getByRole("button", { name: "重置邀请链接" }));
    act(() => { login("other"); login(); });
    await act(async () => { confirmation.resolve(true); });
    expect(mocks.reset).not.toHaveBeenCalled();
  });

  test("剪贴板等待期间退出后不发出迟到提示", async () => {
    const clipboard = deferred<void>();
    const { user, writeText } = setup();
    writeText.mockReturnValue(clipboard.promise);
    await user.click(screen.getByRole("button", { name: "复制邀请链接" }));
    act(() => clearAuthSession());
    await act(async () => { clipboard.resolve(); });
    expect(toast.success).not.toHaveBeenCalled();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  });

  test.each(["请先发布帖子。", "请先保存可见性设置。"])("不可用时说明原因：%s", (unavailableReason) => {
    setup({ unavailableReason });
    expect(screen.getByRole("button", { name: "复制邀请链接" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "重置邀请链接" })).toBeDisabled();
    expect(screen.getByText(unavailableReason)).toBeVisible();
  });
});
