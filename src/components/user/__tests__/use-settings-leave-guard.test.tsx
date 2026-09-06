import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { act, cleanup, renderHook } from "@testing-library/react";
import { useSettingsLeaveGuard } from "@/components/user/use-settings-leave-guard";

const { confirm, router } = vi.hoisted(() => ({ confirm: vi.fn(), router: { push: vi.fn() } }));
vi.mock("@/components/ui/confirm-provider", () => ({ useConfirm: () => confirm }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));

beforeEach(() => { vi.clearAllMocks(); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); document.body.replaceChildren(); });

function clickLink() {
  const link = document.createElement("a");
  link.href = "/me/privacy";
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
  expect(router.push).toHaveBeenCalledWith(new URL("/me/privacy", location.href).href);
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

test("历史返回在 URL 切换前取消，仅确认后重放目的地", async () => {
  const navigation = Object.assign(new EventTarget(), { traverseTo: vi.fn(() => ({ finished: Promise.resolve() })) });
  vi.stubGlobal("navigation", navigation);
  confirm.mockResolvedValueOnce(false).mockResolvedValueOnce(true);
  renderHook(() => useSettingsLeaveGuard(true, false));
  const back = () => Object.assign(new Event("navigate", { cancelable: true }), { navigationType: "traverse", hashChange: false, destination: { key: "previous-page" } });
  const cancelled = back();
  await act(async () => { navigation.dispatchEvent(cancelled); });
  expect(cancelled.defaultPrevented).toBe(true);
  expect(navigation.traverseTo).not.toHaveBeenCalled();
  await act(async () => { navigation.dispatchEvent(back()); });
  expect(navigation.traverseTo).toHaveBeenCalledWith("previous-page");
});
