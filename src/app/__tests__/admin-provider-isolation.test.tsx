import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Providers } from "../providers";
import { useAuth } from "@/lib/auth";
import { clearAuthSession } from "@/lib/auth-store";
const spies = vi.hoisted(() => ({ daily: vi.fn(), lifecycle: vi.fn() }));
vi.mock("next/navigation", () => ({ usePathname: () => "/station/users" }));
vi.mock("@/api/hooks/admin/use-admin-auth", () => ({ useAdminSessionLifecycle: spies.lifecycle, bindAdminClient: () => () => {} }));
vi.mock("@/components/economy/daily-check-in-bootstrap", () => ({ DailyCheckInBootstrap: spies.daily }));
vi.mock("@/components/layout/cover-playback-navigation", () => ({ CoverPlaybackNavigation: () => null }));
vi.mock("sonner", () => ({ Toaster: () => null }));
vi.mock("nuqs/adapters/next/app", () => ({ NuqsAdapter: ({ children }: { children: React.ReactNode }) => children }));
afterEach(() => { cleanup(); clearAuthSession(); vi.unstubAllGlobals(); });
function Probe() {
  const auth=useAuth(); const [text,setText]=useState("draft"); const client=useQueryClient();
  const query=useQuery({ queryKey:["admin","probe"], queryFn:async()=>"后台缓存" });
  return <><input aria-label="草稿" value={text} onChange={e=>setText(e.target.value)} /><p>{query.data}</p><button onClick={()=>{client.setQueryData(["admin","probe"],"当前后台缓存");auth.setAuth({id:"other",email:"x@test.dev",username:"other",avatar:null,role:"USER"},"other-token");}}>切换社区用户</button></>;
}
it("社区身份切换不重挂后台、不丢表单缓存也不调用每日签到", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response('{"code":40100}', { status:401 })));
  render(<Providers><Probe /></Providers>); await screen.findByText("后台缓存");
  const input=screen.getByLabelText("草稿"); fireEvent.change(input,{target:{value:"未保存"}}); fireEvent.click(screen.getByText("切换社区用户"));
  await waitFor(()=>expect(screen.getByText("当前后台缓存")).toBeVisible());
  expect(screen.getByLabelText("草稿")).toBe(input); expect(input).toHaveValue("未保存"); expect(spies.daily).not.toHaveBeenCalled();
});
