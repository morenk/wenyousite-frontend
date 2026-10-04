
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { useThreadIdentitySubmission, type PublicationIdentitySelection } from "../use-thread-identity-submission";
import type { ThreadIdentityState } from "@/api/hooks/use-thread-identity";

const mocks = vi.hoisted(() => ({ query: vi.fn(), read: vi.fn(), confirm: vi.fn(), refetch: vi.fn() }));
vi.mock("@/api/hooks/use-thread-identity", () => ({
  useThreadIdentity: (...args: unknown[]) => mocks.query(...args), readThreadIdentity: mocks.read,
}));
vi.mock("@/components/ui/confirm-provider", () => ({ useConfirm: () => mocks.confirm }));
const state = (): ThreadIdentityState => ({
  threadId: "t1", userId: "u1", enabled: true, eligible: true, canEdit: true,
  identity: { id: "rp1", nickname: "白鸦", avatarMediaId: null, version: 1 },
  display: { id: "rp1", nickname: "白鸦", avatar: null },
  account: { id: "u1", username: "小明", avatar: null }, identityToken: "token-1",
});
beforeEach(() => {
  vi.clearAllMocks(); mocks.query.mockReturnValue({ data: state(), refetch: mocks.refetch });
  mocks.read.mockResolvedValue(state()); mocks.confirm.mockResolvedValue(true);
});
afterEach(cleanup);
test("每次新会话默认有效RP，草稿中选择ACCOUNT不受后续角色变化影响", async () => {
  const { result, rerender } = renderHook(({ scope }) => useThreadIdentitySubmission("t1", true, true, scope), { initialProps: { scope: "one" } });
  expect(result.current.mode).toBe("RP");
  expect(result.current.displayName).toBe("白鸦");
  act(() => result.current.choose("ACCOUNT"));
  mocks.query.mockReturnValue({ data: { ...state(), enabled: false }, refetch: mocks.refetch });
  rerender({ scope: "one" });
  expect(await result.current.prepare()).toEqual({ identityMode: "ACCOUNT" });
  expect(mocks.read).not.toHaveBeenCalled();
  expect(mocks.confirm).not.toHaveBeenCalled();
  mocks.query.mockReturnValue({ data: state(), refetch: mocks.refetch });
  rerender({ scope: "two" });
  expect(result.current.mode).toBe("RP");
});
test("有效RP提交精确token，显式切换不会改变资料", async () => {
  const { result } = renderHook(() => useThreadIdentitySubmission("t1", true, true));
  act(() => result.current.choose("ACCOUNT"));
  act(() => result.current.choose("RP"));
  let prepared: unknown;
  await act(async () => { prepared = await result.current.prepare(); });
  expect(prepared).toEqual({ identityMode: "RP", identityToken: "token-1" });
  expect(mocks.confirm).not.toHaveBeenCalled();
});
test("更名后取消确认保留旧选择，确认后使用最新token和昵称", async () => {
  const { result } = renderHook(() => useThreadIdentitySubmission("t1", true, true));
  mocks.read.mockResolvedValue({ ...state(), display: { id: "rp1", nickname: "夜渡", avatar: null }, identityToken: "token-2" });
  mocks.confirm.mockResolvedValueOnce(false);
  let prepared: unknown;
  await act(async () => { prepared = await result.current.prepare(); });
  expect(prepared).toBeNull();
  expect(result.current.displayName).toBe("白鸦");
  await act(async () => { prepared = await result.current.prepare(); });
  expect(prepared).toEqual({ identityMode: "RP", identityToken: "token-2" });
  expect(result.current.displayName).toBe("夜渡");
});
test.each(["关闭", "撤销资格", "清除资料"])("%s必须确认恢复账号，不静默发布", async (reason) => {
  const { result } = renderHook(() => useThreadIdentitySubmission("t1", true, true));
  const latest = { ...state(), ...(reason === "关闭" ? { enabled: false } : reason === "撤销资格" ? { eligible: false } : { display: null }) };
  mocks.read.mockResolvedValue(latest);
  let prepared: unknown;
  await act(async () => { prepared = await result.current.prepare(); });
  expect(mocks.confirm).toHaveBeenCalledWith(expect.objectContaining({ description: expect.stringContaining("小明") }));
  expect(prepared).toEqual({ identityMode: "ACCOUNT" });
  expect(result.current.mode).toBe("ACCOUNT");
});
test("服务器冲突强制重新确认，即使重新读取token一样", async () => {
  const { result } = renderHook(() => useThreadIdentitySubmission("t1", true, true));
  act(() => result.current.requireConfirmation());
  expect(mocks.refetch).toHaveBeenCalledOnce();
  await act(async () => { await result.current.prepare(); });
  expect(mocks.confirm).toHaveBeenCalledOnce();
});
test("未加载资料不发表，旧后端不发送新字段", async () => {
  mocks.query.mockReturnValue({ data: undefined, refetch: mocks.refetch });
  const { result, rerender } = renderHook(({ supported }) => useThreadIdentitySubmission("t1", supported, true), { initialProps: { supported: true } });
  await expect(result.current.prepare()).rejects.toThrow("加载完成");
  rerender({ supported: false });
  expect(await result.current.prepare()).toBeUndefined();
});
test("不可用RP不能选中，无资料时选择无副作用", () => {
  mocks.query.mockReturnValue({ data: { ...state(), display: null }, refetch: mocks.refetch });
  const { result, rerender } = renderHook(() => useThreadIdentitySubmission("t1", true, true));
  expect(result.current.mode).toBe("ACCOUNT");
  act(() => result.current.choose("RP"));
  expect(result.current.mode).toBe("ACCOUNT");
  mocks.query.mockReturnValue({ data: undefined }); rerender();
  act(() => result.current.choose("ACCOUNT"));
});

test("草稿外部存储跨编辑器重挂载保留ACCOUNT选择及服务器冲突确认标记", async () => {
  let value: PublicationIdentitySelection | undefined;
  const onChange = (next: PublicationIdentitySelection | undefined) => { value = next; };
  const first = renderHook(() => useThreadIdentitySubmission("t1", true, true, "draft", { value, onChange }));
  first.rerender();
  act(() => first.result.current.choose("ACCOUNT"));
  first.rerender();
  first.unmount();
  const second = renderHook(() => useThreadIdentitySubmission("t1", true, true, "draft", { value, onChange }));
  expect(second.result.current.mode).toBe("ACCOUNT");
  expect(await second.result.current.prepare()).toEqual({ identityMode: "ACCOUNT" });
  act(() => second.result.current.choose("RP"));
  second.rerender();
  act(() => second.result.current.requireConfirmation());
  second.unmount();
  const third = renderHook(() => useThreadIdentitySubmission("t1", true, true, "draft", { value, onChange }));
  await act(async () => { await third.result.current.prepare(); });
  expect(mocks.confirm).toHaveBeenCalledOnce();
});
