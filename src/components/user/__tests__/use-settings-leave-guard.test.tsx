import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { act, cleanup, renderHook } from "@testing-library/react";
import { useSettingsLeaveGuard } from "@/components/user/use-settings-leave-guard";

const { confirm, router, blocker } = vi.hoisted(() => ({ confirm: vi.fn(), router: { push: vi.fn() }, blocker: { request: undefined as undefined | ((replay: () => void) => void) } }));
vi.mock("@/lib/navigation-history", () => ({ trackNavigationHistory: () => ({ addBlocker: (value: { request: (replay: () => void) => void }) => { blocker.request = value.request; return vi.fn(); } }) }));
vi.mock("@/components/ui/confirm-provider", () => ({ useConfirm: () => confirm }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));

beforeEach(() => { vi.clearAllMocks(); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); document.body.replaceChildren(); });

function clickLink() {
  const link = document.createElement("a");
  link.href = "/me/security";
  document.body.append(link);
  const event = new MouseEvent("click", { bubbles: true, cancelable: true });
  link.dispatchEvent(event);
  return event;
}

test("脏表单取消离开保留页面，确认后才跳转", async () => {
  confirm.mockResolvedValueOnce(false).mockResolvedValueOnce(true);
  renderHook(() => useSettingsLeaveGuard(true, false));
  await act(async () => { expect(clickLink().defaultPrevented).toBe(true); });
  expect(router.push).not.toHaveBeenCalled();
  await act(async () => { clickLink(); });
  expect(router.push).toHaveBeenCalledWith(new URL("/me/security", location.href).href);
});

test("保存中阻止离开与重复确认；完成后不再阻止刷新", () => {
  const { rerender } = renderHook(({ busy }) => useSettingsLeaveGuard(false, busy), { initialProps: { busy: true } });
  expect(clickLink().defaultPrevented).toBe(true);
  expect(confirm).not.toHaveBeenCalled();
  const event = new Event("beforeunload", { cancelable: true });
  window.dispatchEvent(event);
  expect(event.defaultPrevented).toBe(true);
  rerender({ busy: false });
  const clean = new Event("beforeunload", { cancelable: true });
  window.dispatchEvent(clean);
  expect(clean.defaultPrevented).toBe(false);
});

test("历史适配器恢复位置后先确认，接受才重放", async () => {
  const replay = vi.fn();
  confirm.mockResolvedValueOnce(false).mockResolvedValueOnce(true);
  renderHook(() => useSettingsLeaveGuard(true, false));
  await act(async () => { blocker.request?.(replay); });
  expect(replay).not.toHaveBeenCalled();
  await act(async () => { blocker.request?.(replay); });
  expect(replay).toHaveBeenCalledTimes(1);
});

test("接受站内跳转后组件仍挂载时继续保护新修改", async () => {
  confirm.mockResolvedValueOnce(true).mockResolvedValueOnce(false);
  renderHook(() => useSettingsLeaveGuard(true, false));
  await act(async () => { clickLink(); });
  await act(async () => { expect(clickLink().defaultPrevented).toBe(true); });
  expect(confirm).toHaveBeenCalledTimes(2);
  expect(router.push).toHaveBeenCalledTimes(1);
});
test("确认期间重复点击、保存锁改变和卸载不能绕过保护", async () => {
  let accept!: (value: boolean) => void;
  confirm.mockImplementation(() => new Promise<boolean>((resolve) => { accept = resolve; }));
  const { rerender, unmount } = renderHook(({ busy }) => useSettingsLeaveGuard(true, busy), { initialProps: { busy: false } });
  act(() => { clickLink(); clickLink(); });
  expect(confirm).toHaveBeenCalledTimes(1);
  rerender({ busy: true });
  await act(async () => { accept(true); });
  expect(router.push).not.toHaveBeenCalled();
  rerender({ busy: false });
  act(() => { clickLink(); });
  unmount();
  await act(async () => { accept(true); });
  expect(router.push).not.toHaveBeenCalled();
});
