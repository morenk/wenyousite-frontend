import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createAuthenticatedFetch } from "@/api/client";
import { ADMIN_SESSION_EVENT_KEY, acceptAdminSession, beginAdminSessionChange, getAdminCsrfToken, getAdminSessionSnapshot, registerAdminReset } from "@/lib/admin-session-store";
import { clearAuthSession, getAuthAccessToken, setAuthSession } from "@/lib/auth-store";
import type { AdminSessionData } from "@/api/admin-types";
const session: AdminSessionData = { csrfToken: "csrf", user: { id: "admin", role: "ADMIN" }, session: { id: "a", createdAt: "", lastActiveAt: "", expiresAt: "2099-01-01T00:00:00Z", elevatedUntil: null } };
function authenticate(id = "a") { const generation = beginAdminSessionChange(); acceptAdminSession({ ...session, session: { ...session.session, id } }, generation); }
beforeEach(() => { authenticate(); setAuthSession({ id: "community", username: "community", email: "u@test.dev", avatar: null, role: "USER" }, "public-token"); });
afterEach(() => { window.history.replaceState({}, "", "/"); beginAdminSessionChange(); clearAuthSession(); vi.restoreAllMocks(); });
describe("后台 Cookie 请求与迟到响应", () => {
  it.each([40117, 40118])("仅终态 %s 清理后台，不刷新社区凭据", async (code) => {
    const reset = vi.fn(); const stop = registerAdminReset(reset);
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ code }), { status: 401 }));
    await createAuthenticatedFetch(fetcher)("https://test.dev/api/v1/admin/users");
    expect(getAdminSessionSnapshot().status).toBe("unauthenticated");
    expect(getAdminCsrfToken()).toBeNull(); expect(reset).toHaveBeenCalledTimes(1);
    expect(fetcher).toHaveBeenCalledTimes(1); expect(getAuthAccessToken()).toBe("public-token"); stop();
  });
  it.each([40117, 40118])("主动退出遇到终态 %s 仍保留退出意图并通知其他标签", async (code) => {
    localStorage.removeItem(ADMIN_SESSION_EVENT_KEY);
    beginAdminSessionChange("logout");
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ code }), { status: 401 }));
    await createAuthenticatedFetch(fetcher)("https://test.dev/api/v1/admin/auth/logout", { method: "POST" });
    expect(getAdminSessionSnapshot()).toMatchObject({ status: "unauthenticated", reason: "logout", data: undefined });
    expect(localStorage.getItem(ADMIN_SESSION_EVENT_KEY)).toMatch(/^[a-f0-9-]{36}$/);
    expect(getAdminCsrfToken()).toBeNull();
  });
  it.each([[403, 40300], [401, 40119], [401, 40101], [429, 42900], [500, 50000]])("%s/%s 不清除后台也不进入公共刷新", async (status, code) => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ code }), { status }));
    const response = await createAuthenticatedFetch(fetcher)("https://test.dev/api/v1/admin/users", { headers: { Authorization: "Bearer community" } });
    await response.json();
    expect(getAdminSessionSnapshot().status).toBe("authenticated"); expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it("网络中断不整体退出", async () => {
    await expect(createAuthenticatedFetch(vi.fn().mockRejectedValue(new TypeError("offline")))("https://test.dev/api/v1/admin/users")).rejects.toThrow("offline");
    expect(getAdminSessionSnapshot().status).toBe("authenticated");
  });
  it("headers已返回但正文迟到时，旧成功结果不能进入新会话", async () => {
    let body!: ReadableStreamDefaultController<Uint8Array>;
    const stream = new ReadableStream<Uint8Array>({ start(controller) { body = controller; } });
    const response = await createAuthenticatedFetch(vi.fn().mockResolvedValue(new Response(stream)))("https://test.dev/api/v1/admin/users");
    const parsed = response.json();
    authenticate("new-login");
    body.enqueue(new TextEncoder().encode('{"data":"旧账号内容"}')); body.close();
    await expect(parsed).rejects.toMatchObject({ name: "AbortError" });
    expect(getAdminSessionSnapshot().data?.session.id).toBe("new-login");
  });
  it("旧会话失效响应不能清除之后的新登录", async () => {
    let finish!: (response: Response) => void;
    const request = createAuthenticatedFetch(() => new Promise<Response>((resolve) => { finish = resolve; }))("https://test.dev/api/v1/admin/users");
    authenticate("new-login"); finish(new Response('{"code":40117}', { status: 401 }));
    await expect(request).rejects.toMatchObject({ name: "AbortError" });
    expect(getAdminSessionSnapshot().data?.session.id).toBe("new-login");
  });
});

it("社区请求迟到401只清社区身份，不把后台导航到login", async () => {
  window.history.replaceState({}, "", "/threads");
  let finish!: (response: Response) => void;
  const pending = createAuthenticatedFetch(() => new Promise<Response>((resolve) => { finish = resolve; }))("https://test.dev/api/v1/users/me", { headers: { Authorization: "Bearer public-token" } });
  window.history.replaceState({}, "", "/station/users?q=alice");
  finish(new Response('{"code":40102}', { status: 401 }));
  await pending;
  expect(window.location.pathname).toBe("/station/users");
  expect(getAuthAccessToken()).toBeNull();
  expect(getAdminSessionSnapshot().status).toBe("authenticated");
});
it.each(["complete","cancel"])("管理资产读流%s后释放请求登记",async mode=>{
 let signal:AbortSignal|undefined;
 const response=await createAuthenticatedFetch(async(input)=>{signal=(input as Request).signal;return new Response(new Uint8Array([1,2,3]));})("https://test.dev/api/v1/admin/text-fonts/versions/id/assets/test.png");
 if(mode==="complete"){const reader=response.body!.getReader();expect(Array.from((await reader.read()).value!)).toEqual([1,2,3]);expect((await reader.read()).done).toBe(true);}else await response.body!.cancel();
 authenticate("new-login");expect(signal!.aborted).toBe(false);
});
it("管理资产流的迟到分片不能跨会话继续展示",async()=>{
 let body!:ReadableStreamDefaultController<Uint8Array>;
 const cancel=vi.fn();const response=await createAuthenticatedFetch(async()=>new Response(new ReadableStream<Uint8Array>({start(controller){body=controller;},cancel})))("https://test.dev/api/v1/admin/text-fonts/versions/id/assets/test.png");
 const reader=response.body!.getReader(),next=reader.read();authenticate("new-login");body.enqueue(new Uint8Array([1]));await expect(next).rejects.toMatchObject({name:"AbortError"});expect(cancel).toHaveBeenCalledTimes(1);
});

it("管理资产无正文响应立即释放请求登记",async()=>{
 let signal:AbortSignal|undefined;
 const response=await createAuthenticatedFetch(async(input)=>{signal=(input as Request).signal;return new Response(null,{status:404});})("https://test.dev/api/v1/admin/text-fonts/versions/id/assets/missing.png");
 expect(response.status).toBe(404);expect(response.body).toBeNull();
 authenticate("new-login");expect(signal!.aborted).toBe(false);
});
