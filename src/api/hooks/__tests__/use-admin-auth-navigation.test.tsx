import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useAdminSession, useAdminLogin } from "../admin/use-admin-auth";
import { clearAdminListPagination, useCursorPagination } from "@/hooks/use-cursor-pagination";
const api = vi.hoisted(() => ({ GET: vi.fn(), POST: vi.fn(), csrf: vi.fn() }));
vi.mock("@/api/client", () => ({ apiClient: api, setAdminCsrfToken: api.csrf }));
const wrapper = ({ children }: { children: React.ReactNode }) => <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>{children}</QueryClientProvider>;
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
afterEach(() => { clearAdminListPagination(); vi.clearAllMocks(); });
describe("管理身份与列表状态", () => {
  it.each([401, 403])("会话返回%s时清除旧访问栈", async (status) => {
    retain();
    api.GET.mockResolvedValue({ error: { code: 40100 }, response: { status } });
    const result = renderHook(() => useAdminSession(), { wrapper });
    await waitFor(() => expect(result.result.current.isError).toBe(true));
    expect(currentPage()).toBe(1);
  });
  it("网络失败不清除有效访问栈", async () => {
    retain();
    api.GET.mockRejectedValue(new TypeError("network"));
    const result = renderHook(() => useAdminSession(), { wrapper });
    await waitFor(() => expect(result.result.current.isError).toBe(true));
    expect(currentPage()).toBe(2);
  });
  it("登录成功后清除上一个账号的访问栈", async () => {
    retain();
    api.POST.mockResolvedValue({ data: { data: { csrfToken: "test", user: { id: "new-admin" }, session: {} } } });
    const result = renderHook(() => useAdminLogin(), { wrapper });
    await act(async () => { await result.result.current.verify.mutateAsync({ challengeId: "challenge", code: "123456" }); });
    expect(api.POST).toHaveBeenCalledWith("/api/v1/admin/auth/verify", {
      body: { challengeId: "challenge", code: "123456", rememberDevice: false },
    });
    expect(currentPage()).toBe(1);
  });
});
