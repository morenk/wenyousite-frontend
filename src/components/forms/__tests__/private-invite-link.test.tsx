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
});
afterEach(() => { cleanup(); clearAuthSession(); });

describe("私密邀请单按钮分享", () => {
  test("仅显示复制按钮，无邀请卡片标题、说明或重置入口", () => {
    const { container } = setup();
    expect(screen.getAllByRole("button")).toHaveLength(1);
    expect(screen.getByRole("button", { name: "复制邀请链接" })).toBeEnabled();
    expect(screen.queryByText("私密访问")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "重置邀请链接" })).not.toBeInTheDocument();
    expect(container.querySelector("section")).toBeNull();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  });

  test("每次复制向服务端取得当前链接，成功只用短toast，重开也不要求本地保存", async () => {
    const { user, writeText, unmount } = setup();
    await user.click(screen.getByRole("button", { name: "复制邀请链接" }));
    await user.click(screen.getByRole("button", { name: "复制邀请链接" }));
    expect(mocks.ensure).toHaveBeenCalledTimes(2);
    expect(mocks.reset).not.toHaveBeenCalled();
    expect(mocks.confirm).not.toHaveBeenCalled();
    expect(writeText.mock.calls[0]).toEqual(writeText.mock.calls[1]);
    expect(toast.success).toHaveBeenLastCalledWith("邀请链接已复制");
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(screen.queryByText("邀请链接已复制")).not.toBeInTheDocument();
    unmount(); render(element());
    await user.click(screen.getByRole("button", { name: "复制邀请链接" }));
    expect(writeText.mock.calls[2]).toEqual(writeText.mock.calls[0]);
    expect(localStorage.getItem("invite-link")).toBeNull();
  });

  test("只有剪贴板失败才就地展示完整可选择URL与手动复制提示", async () => {
    const { user, writeText } = setup();
    writeText.mockRejectedValue(new Error("denied"));
    await user.click(screen.getByRole("button", { name: "复制邀请链接" }));
    expect(screen.getByRole("status")).toHaveTextContent("自动复制失败，请手动复制下方链接");
    const input = screen.getByRole("textbox", { name: "当前邀请链接" }) as HTMLTextAreaElement;
    expect(input).toHaveValue(`${window.location.origin}/join/current-link`);
    expect(input).toHaveAttribute("readonly");
    await user.click(input);
    expect(input.selectionStart).toBe(0); expect(input.selectionEnd).toBe(input.value.length);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(mocks.reset).not.toHaveBeenCalled();
    expect(toast.success).not.toHaveBeenCalled();
  });

  test("再次复制先收起旧手动URL，成功后不常驻结果", async () => {
    const { user, writeText } = setup();
    writeText.mockRejectedValueOnce(new Error("denied"));
    await user.click(screen.getByRole("button", { name: "复制邀请链接" }));
    const pending = deferred<{ token: string }>(); mocks.ensure.mockReturnValueOnce(pending.promise);
    await user.click(screen.getByRole("button", { name: "复制邀请链接" }));
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    await act(async () => { pending.resolve({ token: "current-link" }); });
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(toast.success).toHaveBeenCalledWith("邀请链接已复制");
  });

  test.each([{ code: 40400, message: "接口不可用" }, new TypeError("offline"), { code: 40302, message: "仅楼主可用" }])("获取失败提示重试、不回退POST、不保留旧凭据", async (error) => {
    const { user, writeText } = setup();
    writeText.mockRejectedValueOnce(new Error("denied"));
    await user.click(screen.getByRole("button", { name: "复制邀请链接" }));
    mocks.ensure.mockRejectedValueOnce(error);
    await user.click(screen.getByRole("button", { name: "复制邀请链接" }));
    expect(mocks.reset).not.toHaveBeenCalled();
    expect(writeText).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    expect(toast.error).toHaveBeenLastCalledWith(expect.stringContaining("重试"));
  });

  test("请求锁覆盖PUT和剪贴板等待，阻止重复提交", async () => {
    const request = deferred<{ token: string }>(); const clipboard = deferred<void>();
    mocks.ensure.mockReturnValue(request.promise);
    const { user, writeText } = setup(); writeText.mockReturnValue(clipboard.promise);
    const copy = screen.getByRole("button", { name: "复制邀请链接" });
    await user.click(copy); expect(copy).toBeDisabled(); fireEvent.click(copy);
    await act(async () => { request.resolve({ token: "current-link" }); });
    expect(copy).toBeDisabled(); fireEvent.click(copy);
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    await act(async () => { clipboard.resolve(); });
    expect(copy).toBeEnabled(); expect(mocks.ensure).toHaveBeenCalledTimes(1);
  });

  test.each(["unmount", "account", "route", "thread", "unavailable"])("等待响应时%s会使旧响应失效，不写剪贴板、不提示", async (change) => {
    const request = deferred<{ token: string }>(); mocks.ensure.mockReturnValue(request.promise);
    const { user, writeText, unmount, rerender } = setup();
    await user.click(screen.getByRole("button", { name: "复制邀请链接" }));
    if (change === "unmount") unmount();
    if (change === "account") act(() => login("other"));
    if (change === "route") { mocks.path = "/threads/other/edit"; rerender(element()); }
    if (change === "thread") rerender(element({ threadId: "other" }));
    if (change === "unavailable") rerender(element({ unavailableReason: "请先保存可见性设置。" }));
    await act(async () => { request.resolve({ token: "late-secret" }); });
    expect(writeText).not.toHaveBeenCalled(); expect(toast.success).not.toHaveBeenCalled();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  });

  test.each(["account", "route", "thread"])("%s变化清理手动复制URL", async (change) => {
    const { user, writeText, rerender } = setup(); writeText.mockRejectedValue(new Error("denied"));
    await user.click(screen.getByRole("button", { name: "复制邀请链接" }));
    expect(screen.getByRole("textbox")).toBeInTheDocument();
    if (change === "account") { act(() => login("other")); act(() => login()); }
    if (change === "route") { mocks.path = "/threads/other/edit"; rerender(element()); }
    if (change === "thread") rerender(element({ threadId: "other" }));
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  });

  test("请求期间切号再切回也不处理旧响应", async () => {
    const request = deferred<{ token: string }>(); mocks.ensure.mockReturnValue(request.promise);
    const { user, writeText } = setup();
    await user.click(screen.getByRole("button", { name: "复制邀请链接" }));
    act(() => { login("other"); login(); });
    await act(async () => { request.resolve({ token: "late-secret" }); });
    expect(writeText).not.toHaveBeenCalled();
  });

  test.each(["resolve", "reject"])("剪贴板等待期间退出后忽略%s结果", async (outcome) => {
    const clipboard = deferred<void>(); const { user, writeText } = setup(); writeText.mockReturnValue(clipboard.promise);
    await user.click(screen.getByRole("button", { name: "复制邀请链接" }));
    act(() => clearAuthSession());
    await act(async () => { if (outcome === "resolve") clipboard.resolve(); else clipboard.reject(new Error("denied")); });
    expect(toast.success).not.toHaveBeenCalled(); expect(toast.error).not.toHaveBeenCalled();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  });

  test.each(["请先发布帖子。", "请先保存可见性设置。"])("不可用时禁用且不增加常驻说明：%s", (unavailableReason) => {
    setup({ unavailableReason });
    expect(screen.getByRole("button", { name: "复制邀请链接" })).toBeDisabled();
    expect(screen.queryByText(unavailableReason)).not.toBeInTheDocument();
  });

  test.each(["anonymous", "other"])("%s无复制入口", (identity) => {
    if (identity === "anonymous") clearAuthSession(); else login(identity);
    setup(); expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});
