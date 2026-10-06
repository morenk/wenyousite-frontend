import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { useThreadIdentitySubmission, type PublicationIdentitySelection } from "../use-thread-identity-submission";
import { collection, role } from "./rp-identity-fixtures";
const mocks = vi.hoisted(() => ({ query: vi.fn(), read: vi.fn(), confirm: vi.fn(), refetch: vi.fn() }));
vi.mock("@/api/hooks/use-rp-identities", async (original) => ({
  ...await original<typeof import("@/api/hooks/use-rp-identities")>(),
  useRpIdentities: (...args: unknown[]) => mocks.query(...args), readRpIdentities: mocks.read,
}));
vi.mock("@/components/ui/confirm-provider", () => ({ useConfirm: () => mocks.confirm }));
beforeEach(() => {
  vi.clearAllMocks(); mocks.query.mockReturnValue({ data: collection(), refetch: mocks.refetch });
  mocks.read.mockResolvedValue(collection()); mocks.confirm.mockResolvedValue(true);
});
afterEach(cleanup);
test("新空稿始终ACCOUNT，不采用default或兼容角色；ACCOUNT草稿不受角色变化影响", async () => {
  const { result, rerender } = renderHook(({ scope }) => useThreadIdentitySubmission("t1", true, true, scope), { initialProps: { scope: "one" } });
  expect(result.current.mode).toBe("ACCOUNT");
  expect(result.current.identityId).toBeUndefined();
  mocks.query.mockReturnValue({ data: collection([], { enabled: false }), refetch: mocks.refetch });
  rerender({ scope: "one" });
  expect(await result.current.prepare()).toEqual({ identityMode: "ACCOUNT" });
  expect(mocks.read).not.toHaveBeenCalled(); expect(mocks.confirm).not.toHaveBeenCalled();
  mocks.query.mockReturnValue({ data: collection([role("rp2")], { defaultIdentityId: "rp2" }), refetch: mocks.refetch });
  rerender({ scope: "two" }); expect(result.current.mode).toBe("ACCOUNT"); expect(result.current.identityId).toBeUndefined();
});
test("同名角色按ID选择，发表携带对应ID和token", async () => {
  const data = collection([role(), role("rp2")]);
  mocks.query.mockReturnValue({ data }); mocks.read.mockResolvedValue(data);
  const { result } = renderHook(() => useThreadIdentitySubmission("t1", true, true));
  act(() => result.current.choose("RP", "rp2"));
  let prepared: unknown; await act(async () => { prepared = await result.current.prepare(); });
  expect(prepared).toEqual({ identityMode: "RP", identityId: "rp2", identityToken: "token-rp2" });
  expect(mocks.confirm).not.toHaveBeenCalled();
});
test("修改所选角色后取消保留旧选择，确认后使用同一ID新token", async () => {
  const { result } = renderHook(() => useThreadIdentitySubmission("t1", true, true));
  act(() => result.current.choose("RP", "rp1"));
  mocks.read.mockResolvedValue(collection([role("rp1", "夜渡", { identityToken: "new-token" })]));
  mocks.confirm.mockResolvedValueOnce(false);
  let prepared: unknown; await act(async () => { prepared = await result.current.prepare(); });
  expect(prepared).toBeNull(); expect(result.current.displayName).toBe("白鸦");
  await act(async () => { prepared = await result.current.prepare(); });
  expect(prepared).toEqual({ identityMode: "RP", identityId: "rp1", identityToken: "new-token" });
  expect(result.current.displayName).toBe("夜渡");
});
test.each(["关闭", "撤销资格", "清空", "删除"])("%s后确认账号回落，绝不选择另一个可用RP", async (reason) => {
  const { result } = renderHook(() => useThreadIdentitySubmission("t1", true, true));
  act(() => result.current.choose("RP", "rp1"));
  mocks.read.mockResolvedValue(collection([
    ...(reason === "删除" ? [] : [role("rp1", "白鸦", reason === "清空" ? { display: null } : {})]), role("rp2", "另一角色"),
  ], { enabled: reason !== "关闭", eligible: reason !== "撤销资格", defaultIdentityId: "rp2" }));
  let prepared: unknown; await act(async () => { prepared = await result.current.prepare(); });
  expect(mocks.confirm).toHaveBeenCalledWith(expect.objectContaining({ description: expect.stringContaining("小明") }));
  expect(prepared).toEqual({ identityMode: "ACCOUNT" }); expect(result.current.mode).toBe("ACCOUNT");
});
test("恢复的旧RP草稿无ID时只查兼容角色，兼容已删除则确认账号", async () => {
  const saved: PublicationIdentitySelection = { scope: "draft", mode: "RP", token: "token-rp1", name: "白鸦" };
  const data = collection([role("rp2")], { compatibilityIdentityId: null, defaultIdentityId: "rp2" });
  mocks.query.mockReturnValue({ data }); mocks.read.mockResolvedValue(data);
  const onChange = vi.fn();
  const { result } = renderHook(() => useThreadIdentitySubmission("t1", true, true, "draft", { value: saved, onChange }));
  expect(result.current.identityId).toBeUndefined(); expect(onChange).not.toHaveBeenCalled();
  await act(async () => { expect(await result.current.prepare()).toEqual({ identityMode: "ACCOUNT" }); });
  expect(mocks.confirm).toHaveBeenCalledOnce();
});
test("恢复旧RP草稿可以解析兼容锚点，不采用不同的default", async () => {
  const data = collection([role(), role("rp2")], { defaultIdentityId: "rp2" });
  mocks.query.mockReturnValue({ data }); mocks.read.mockResolvedValue(data);
  const { result } = renderHook(() => useThreadIdentitySubmission("t1", true, true, "draft", {
    value: { scope: "draft", mode: "RP", token: "token-rp1", name: "白鸦" }, onChange: vi.fn(),
  }));
  expect(result.current.identityId).toBe("rp1");
  await act(async () => { expect(await result.current.prepare()).toEqual({ identityMode: "RP", identityId: "rp1", identityToken: "token-rp1" }); });
  expect(mocks.confirm).not.toHaveBeenCalled();
});
test("空角色不可发表；新增成功明确选择新ID", () => {
  mocks.query.mockReturnValue({ data: collection([role("rp1", "", { display: null })]) });
  const { result } = renderHook(() => useThreadIdentitySubmission("t1", true, true));
  expect(result.current.mode).toBe("ACCOUNT");
  act(() => result.current.choose("RP", "rp1")); expect(result.current.mode).toBe("ACCOUNT");
  act(() => result.current.chooseCreated(role("rp2", "新角色")));
  expect(result.current.identityId).toBe("rp2");
});
test("服务器冲突必须重新确认，即使token没变", async () => {
  const { result } = renderHook(() => useThreadIdentitySubmission("t1", true, true));
  act(() => result.current.choose("RP", "rp1"));
  act(() => result.current.requireConfirmation()); expect(mocks.refetch).toHaveBeenCalledOnce();
  await act(async () => { await result.current.prepare(); }); expect(mocks.confirm).toHaveBeenCalledOnce();
});
test("未加载资料不发表，旧后端不发送新字段", async () => {
  mocks.query.mockReturnValue({ data: undefined });
  const { result, rerender } = renderHook(({ supported }) => useThreadIdentitySubmission("t1", supported, true), { initialProps: { supported: true } });
  await expect(result.current.prepare()).rejects.toThrow("加载完成");
  act(() => result.current.choose("ACCOUNT"));
  rerender({ supported: false }); expect(await result.current.prepare()).toBeUndefined();
});
test("外部草稿跨重挂载保留角色ID和服务器冲突确认标记", async () => {
  let value: PublicationIdentitySelection | undefined;
  const onChange = (next: PublicationIdentitySelection | undefined) => { value = next; };
  const first = renderHook(() => useThreadIdentitySubmission("t1", true, true, "draft", { value, onChange }));
  first.rerender(); act(() => first.result.current.chooseCreated(role("rp2")));
  first.rerender(); act(() => first.result.current.requireConfirmation()); first.unmount();
  const data = collection([role(), role("rp2")]); mocks.query.mockReturnValue({ data }); mocks.read.mockResolvedValue(data);
  const second = renderHook(() => useThreadIdentitySubmission("t1", true, true, "draft", { value, onChange }));
  expect(second.result.current.identityId).toBe("rp2");
  await act(async () => { await second.result.current.prepare(); }); expect(mocks.confirm).toHaveBeenCalledOnce();
});
