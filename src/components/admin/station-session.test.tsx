import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { bindAdminClient } from "@/api/hooks/admin/use-admin-auth";
import { acceptAdminSession, beginAdminSessionChange, expireAdminSession, getAdminSessionSnapshot } from "@/lib/admin-session-store";
import { queryKeys } from "@/api/query-keys";
import { StationFrame } from "./station-frame";
import type { AdminSessionData } from "@/api/admin-types";
const api = vi.hoisted(() => ({ GET: vi.fn(), POST: vi.fn(), replace: vi.fn() }));
vi.mock("@/api/client", () => ({ apiClient: api }));
vi.mock("next/navigation", () => ({ usePathname: () => "/station/users", useRouter: () => ({ replace: api.replace }) }));
const session: AdminSessionData = { csrfToken: "csrf", user: { id: "admin", role: "ADMIN" }, session: { id: "a", createdAt: "", lastActiveAt: "", expiresAt: "2099-01-01T00:00:00Z", elevatedUntil: null } };
let client: QueryClient;
beforeEach(() => {
  vi.clearAllMocks(); client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  acceptAdminSession(session, beginAdminSessionChange());
  client.setQueryData(queryKeys.admin.session, session);
  client.setQueryData(queryKeys.admin.users({}), { sensitive: "旧用户信息" });
});
afterEach(() => { cleanup(); client.clear(); beginAdminSessionChange(); });
function show() { return render(<QueryClientProvider client={client}><StationFrame title="用户管理"><input aria-label="未保存理由" defaultValue="待保存理由" /><p>旧用户信息</p></StationFrame></QueryClientProvider>); }
it.each([40117, 40118])("真实旧缓存存在时终态 %s 立即卸载后台并移除缓存", async (code) => {
  show(); expect(screen.getByText("旧用户信息")).toBeVisible();
  api.GET.mockResolvedValue({ error: { code }, response: { status: 401 } });
  await act(async () => { await client.refetchQueries({ queryKey: queryKeys.admin.session }); });
  expect(screen.queryByText("旧用户信息")).not.toBeInTheDocument();
  expect(client.getQueriesData({ queryKey: queryKeys.admin.root }).every(([, data]) => data === undefined)).toBe(true);
  expect(client.getQueryData(queryKeys.admin.users({}))).toBeUndefined();
  expect(api.replace).toHaveBeenCalledWith(expect.stringContaining("/station?returnTo="));
});
it("网络复核失败保留表单，禁用操作且重试成功后继续编辑", async () => {
  const view = show(); const input = screen.getByLabelText("未保存理由"); fireEvent.change(input, { target: { value: "仍在填写" } });
  api.GET.mockRejectedValueOnce(new TypeError("offline"));
  await act(async () => { await client.refetchQueries({ queryKey: queryKeys.admin.session }); });
  expect(getAdminSessionSnapshot().status).toBe("unavailable");
  expect(screen.getByLabelText("未保存理由")).toBe(input); expect(input).toHaveValue("仍在填写");
  expect(view.container.querySelector('[data-slot="station-workspace"]')).toHaveAttribute("inert");
  expect(api.replace).not.toHaveBeenCalled();
  api.GET.mockResolvedValue({ data: { data: session } });
  fireEvent.click(screen.getByRole("button", { name: "重试" }));
  await waitFor(() => expect(view.container.querySelector('[data-slot="station-workspace"]')).not.toHaveAttribute("inert"));
  expect(input).toHaveValue("仍在填写");
});

it("页面离开后台后，在途请求确认过期仍清除Provider持有的缓存", () => {
  const dispose = bindAdminClient(client);
  const view = show(); view.unmount();
  expect(client.getQueryData(queryKeys.admin.users({}))).toEqual({ sensitive: "旧用户信息" });
  expireAdminSession(getAdminSessionSnapshot().generation);
  expect(client.getQueryData(queryKeys.admin.users({}))).toBeUndefined();
  expect(client.getQueryData(queryKeys.admin.session)).toBeUndefined();
  dispose();
});
