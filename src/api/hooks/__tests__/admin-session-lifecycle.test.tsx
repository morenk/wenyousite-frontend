import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider, focusManager, onlineManager } from "@tanstack/react-query";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { useAdminSessionLifecycle } from "../admin/use-admin-auth";
import { ADMIN_SESSION_EVENT_KEY, acceptAdminSession, beginAdminSessionChange, getAdminSessionSnapshot } from "@/lib/admin-session-store";
import { queryKeys } from "@/api/query-keys";
import type { AdminSessionData } from "@/api/admin-types";
const api = vi.hoisted(() => ({ GET: vi.fn() }));
vi.mock("@/api/client", () => ({ apiClient: api }));
const session: AdminSessionData = { csrfToken:"csrf", user:{id:"admin",role:"ADMIN"}, session:{id:"a",createdAt:"",lastActiveAt:"",expiresAt:"2099-01-01T00:00:00Z",elevatedUntil:null} };
let client: QueryClient;
function mount() { return renderHook(()=>useAdminSessionLifecycle(),{wrapper:({children})=><QueryClientProvider client={client}>{children}</QueryClientProvider>}); }
beforeEach(()=>{ vi.clearAllMocks(); beginAdminSessionChange(); client=new QueryClient({defaultOptions:{queries:{retry:false}}}); api.GET.mockResolvedValue({data:{data:session}}); });
afterEach(()=>{cleanup();client.clear();beginAdminSessionChange();focusManager.setFocused(undefined);onlineManager.setOnline(true);vi.useRealTimers();});
it("社区返回后台和遗漏跨标签事件后，重新进入必核验而不信旧缓存", async()=>{
  const first=mount(); await waitFor(()=>expect(getAdminSessionSnapshot().status).toBe("authenticated"));first.unmount();
  api.GET.mockResolvedValue({error:{code:40118},response:{status:401}});mount();
  await waitFor(()=>expect(getAdminSessionSnapshot().status).toBe("unauthenticated"));expect(api.GET).toHaveBeenCalledTimes(2);
});
it("storage只传无凭据事件，接收方重新请求session",async()=>{
  mount();await waitFor(()=>expect(getAdminSessionSnapshot().status).toBe("authenticated"));
  api.GET.mockResolvedValue({data:{data:{...session,user:{id:"other-admin",role:"ADMIN"}}}});
  act(()=>window.dispatchEvent(new StorageEvent("storage",{key:ADMIN_SESSION_EVENT_KEY,newValue:"nonce-only"})));
  await waitFor(()=>expect(getAdminSessionSnapshot().data?.user.id).toBe("other-admin"));expect(api.GET).toHaveBeenCalledTimes(2);
});
it("focus与断网重连触发复核，无其他保活轮询",async()=>{
  mount();await waitFor(()=>expect(getAdminSessionSnapshot().status).toBe("authenticated"));
  act(()=>focusManager.setFocused(false));act(()=>focusManager.setFocused(true));
  await waitFor(()=>expect(api.GET).toHaveBeenCalledTimes(2));
  act(()=>onlineManager.setOnline(false));act(()=>onlineManager.setOnline(true));
  await waitFor(()=>expect(api.GET).toHaveBeenCalledTimes(3));
});
it("已返回绝对expiresAt只安排一次到期复核",async()=>{
  vi.useFakeTimers();const soon={...session,session:{...session.session,expiresAt:new Date(Date.now()+1000).toISOString()}};
  acceptAdminSession(soon,beginAdminSessionChange());client.setQueryData(queryKeys.admin.session,soon);api.GET.mockResolvedValue({data:{data:soon}});
  mount();await act(async()=>{await vi.advanceTimersByTimeAsync(10);});
  expect(api.GET).toHaveBeenCalledTimes(1);
  await act(async()=>{await vi.advanceTimersByTimeAsync(1000);});expect(api.GET).toHaveBeenCalledTimes(2);
  await act(async()=>{await vi.advanceTimersByTimeAsync(60000);});expect(api.GET).toHaveBeenCalledTimes(2);
});

it("窗口从其他应用重新获焦点也核验，正在核验时多个focus不重复请求", async()=>{
  mount();await waitFor(()=>expect(getAdminSessionSnapshot().status).toBe("authenticated"));
  let finish!: (value:unknown)=>void;
  api.GET.mockImplementationOnce(()=>new Promise(resolve=>{finish=resolve;}));
  act(()=>{window.dispatchEvent(new Event("focus"));window.dispatchEvent(new Event("focus"));});
  await waitFor(()=>expect(api.GET).toHaveBeenCalledTimes(2));
  await act(async()=>{finish({data:{data:session}});});
  expect(getAdminSessionSnapshot().status).toBe("authenticated");
});
