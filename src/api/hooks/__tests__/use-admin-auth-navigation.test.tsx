import { useState } from "react";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";
import { acceptAdminSession, beginAdminSessionChange, getAdminSessionSnapshot } from "@/lib/admin-session-store";
import { useAdminSession, useAdminLogin, useAdminLogout } from "../admin/use-admin-auth";
import { clearAdminListPagination, useCursorPagination } from "@/hooks/use-cursor-pagination";
const api = vi.hoisted(() => ({ GET: vi.fn(), POST: vi.fn(), csrf: vi.fn() }));
vi.mock("@/api/client", () => ({ apiClient: api, setAdminCsrfToken: api.csrf }));
const Wrapper = ({ children }: { children: React.ReactNode }) => { const [client] = useState(() => new QueryClient({ defaultOptions: { queries: { retry: false } } })); return <QueryClientProvider client={client}>{children}</QueryClientProvider>; };
function retain() {
  const result = renderHook(() => useCursorPagination("all", "admin-users"));
  act(() => result.result.current.next("old-account-page"));
  result.unmount();
}
function currentPage() {
  const result = renderHook(() => useCursorPagination("all", "admin-users"));
  const page = result.result.current.page;
  result.unmount();
  return page;
}
afterEach(() => { cleanup(); beginAdminSessionChange(); clearAdminListPagination(); vi.clearAllMocks(); });
describe("管理身份与列表状态", () => {
  it.each([40117, 40118])("会话返回%s时清除旧访问栈", async (code) => {
    retain();
    api.GET.mockResolvedValue({ error: { code }, response: { status: 401 } });
    const result = renderHook(() => useAdminSession(), { wrapper: Wrapper });
    await waitFor(() => expect(result.result.current.sessionStatus).toBe("unauthenticated"));
    expect(currentPage()).toBe(1);
  });
  it("网络失败不清除有效访问栈", async () => {
    retain();
    api.GET.mockRejectedValue(new TypeError("network"));
    const result = renderHook(() => useAdminSession(), { wrapper: Wrapper });
    await waitFor(() => expect(result.result.current.sessionStatus).toBe("unavailable"));
    expect(currentPage()).toBe(2);
  });
  it("登录成功后清除上一个账号的访问栈", async () => {
    retain();
    api.POST.mockResolvedValue({ data: { data: { csrfToken: "test", user: { id: "new-admin" }, session: {} } } });
    const result = renderHook(() => useAdminLogin(), { wrapper: Wrapper });
    await act(async () => { await result.result.current.verify.mutateAsync({ challengeId: "challenge", code: "123456", rememberDevice: false }); });
    expect(currentPage()).toBe(1);
  });
});

it("登录响应中断保持unavailable，重试session恢复服务器已建立的Cookie会话", async () => {
  api.GET.mockResolvedValue({ error: { code: 40117 }, response: { status: 401 } });
  const result = renderHook(() => ({ login: useAdminLogin(), session: useAdminSession() }), { wrapper: Wrapper });
  await waitFor(() => expect(result.result.current.session.sessionStatus).toBe("unauthenticated"));
  api.GET.mockRejectedValue(new TypeError("connection lost"));
  api.POST.mockRejectedValueOnce(new TypeError("response lost"));
  await act(async () => { await expect(result.result.current.login.verify.mutateAsync({ challengeId: "challenge", code: "123456", rememberDevice: true })).rejects.toThrow("response lost"); });
  expect(result.result.current.session.sessionStatus).toBe("unavailable");
  api.GET.mockResolvedValue({ data: { data: { csrfToken: "restored", user: { id: "new-admin", role: "ADMIN" }, session: { id: "new-session" } } } });
  await act(async () => { await result.result.current.session.refetch(); });
  expect(result.result.current.session.sessionStatus).toBe("authenticated");
});

it.each([40117, 40118])("主动退出返回%s视为已退出，不产生错误提示", async (code) => {
  api.POST.mockResolvedValue({ error: { code }, response: { status: 401 } });
  const result = renderHook(() => useAdminLogout(), { wrapper: Wrapper });
  await act(async () => { await expect(result.result.current.mutateAsync()).resolves.toBeUndefined(); });
  expect(getAdminSessionSnapshot()).toMatchObject({ status: "unauthenticated", reason: "logout" });
});

it.each([[403, 40301], [500, 50000]])("主动退出失败%s不宣称已撤销，可重试核验", async (status, code) => {
  api.POST.mockResolvedValue({ error: { code }, response: { status } });
  const result = renderHook(() => useAdminLogout(), { wrapper: Wrapper });
  await act(async () => { await expect(result.result.current.mutateAsync()).rejects.toMatchObject({ code }); });
  expect(getAdminSessionSnapshot().status).toBe("unavailable");
  expect(getAdminSessionSnapshot().reason).not.toBe("logout");
});
it("验证码业务错误留在登录页且不制造登录过期提示", async () => {
  api.POST.mockResolvedValue({ error: { code: 40001, message: "验证码错误" } });
  const result = renderHook(() => useAdminLogin(), { wrapper: Wrapper });
  await act(async () => { await expect(result.result.current.verify.mutateAsync({ challengeId: "challenge", code: "123456", rememberDevice: false })).rejects.toMatchObject({ code: 40001 }); });
  expect(getAdminSessionSnapshot()).toMatchObject({ status: "unauthenticated", reason: undefined });
});
it("旧登录成功迟到不能覆盖随后建立的新管理员", async () => {
  let complete!: (value: unknown) => void;
  api.POST.mockImplementation(() => new Promise(resolve => { complete = resolve; }));
  const result = renderHook(() => useAdminLogin(), { wrapper: Wrapper });
  const current = { csrfToken: "new-csrf", user: { id: "new-admin", role: "ADMIN" as const }, session: { id: "new-session", createdAt: "", lastActiveAt: "", expiresAt: "2099-01-01T00:00:00Z", elevatedUntil: null } };
  await act(async () => {
    const pending = result.result.current.verify.mutateAsync({ challengeId: "challenge", code: "123456", rememberDevice: false });
    await Promise.resolve();
    acceptAdminSession(current, beginAdminSessionChange("login"));
    complete({ data: { data: { ...current, user: { id: "old-admin" } } } });
    await expect(pending).rejects.toMatchObject({ name: "AbortError" });
  });
  expect(getAdminSessionSnapshot().data?.user.id).toBe("new-admin");
  expect(getAdminSessionSnapshot().status).toBe("authenticated");
});
