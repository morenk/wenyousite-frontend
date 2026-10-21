import { afterEach, expect, test, vi } from "vitest";
import { FontDownloadScheduler } from "../thread-font-scheduler";
const policy = { concurrency: 2, windowMs: 1000, requestsPerWindow: 64, bytesPerWindow: 16 * 1024 * 1024, originalBytesPerWindow: 18410600 };
afterEach(() => vi.useRealTimers());
test("超过原64请求和16MiB后等待窗口补充，累计浏览继续推进且并发有界", async () => {
 vi.useFakeTimers();
 const scheduler = new FontDownloadScheduler(policy), controller = new AbortController();
 let active = 0, peak = 0, completed = 0;
 const tasks = Array.from({ length: 145 }, () => scheduler.run(256 * 1024, false, controller.signal, async () => {
  active++; peak = Math.max(peak, active); await new Promise(resolve => setTimeout(resolve, 1)); active--; completed++;
 }));
 await vi.advanceTimersByTimeAsync(999); expect(completed).toBe(64); expect(scheduler.snapshot.queued).toBe(81);
 await vi.advanceTimersByTimeAsync(2000); await Promise.all(tasks);
 expect(completed).toBe(145); expect(peak).toBe(2); expect(scheduler.snapshot).toMatchObject({ active: 0, queued: 0 });
 expect(scheduler.snapshot.windowBytes).toBeLessThanOrEqual(policy.bytesPerWindow);
});
test("字节与请求分别约束，小城独立窗口不能借用普通额度", async () => {
 vi.useFakeTimers();const scheduler = new FontDownloadScheduler({ ...policy, requestsPerWindow: 3, bytesPerWindow: 10, originalBytesPerWindow: 20 });
 const signal = new AbortController().signal, done: string[] = [];
 const a = scheduler.run(10, false, signal, async () => { done.push("ordinary") });
 const b = scheduler.run(20, true, signal, async () => { done.push("original") });
 const c = scheduler.run(1, false, signal, async () => { done.push("next") });
 await vi.advanceTimersByTimeAsync(999); expect(done).toEqual(["ordinary", "original"]);
 await vi.advanceTimersByTimeAsync(1); await Promise.all([a,b,c]);expect(done).toEqual(["ordinary", "original", "next"]);
 await expect(scheduler.run(11, false, signal, async () => {})).rejects.toThrow("asset-window-size");
});
test("离屏取消排队不消耗预算也不遗留定时器，离线与重复唤醒不多重排队", async () => {
 vi.useFakeTimers();const scheduler = new FontDownloadScheduler(policy), controller = new AbortController(), task = vi.fn(async () => {});
 scheduler.setPaused(true);const pending = scheduler.run(1, false, controller.signal, task);const rejected=expect(pending).rejects.toMatchObject({name:"AbortError"});
 controller.abort();await rejected;expect(scheduler.snapshot).toMatchObject({queued:0,windowRequests:0});expect(vi.getTimerCount()).toBe(0);
 const next=scheduler.run(1,false,new AbortController().signal,task);
 for(let i=0;i<10;i++)scheduler.setPaused(false);
 await next;expect(task).toHaveBeenCalledTimes(1);expect(scheduler.stats.started).toBe(1);
});
test("失败尝试仍占用当前窗口，但下一窗口不会永久停住", async () => {
 vi.useFakeTimers();const scheduler=new FontDownloadScheduler({...policy,requestsPerWindow:1});const signal=new AbortController().signal;
 await expect(scheduler.run(1,false,signal,async()=>{throw Error("offline")})).rejects.toThrow("offline");
 const task=vi.fn(async()=>42),next=scheduler.run(1,false,signal,task);expect(task).not.toHaveBeenCalled();
 await vi.advanceTimersByTimeAsync(1000);await expect(next).resolves.toBe(42);expect(scheduler.stats.started).toBe(2);
});
test("策略收紧保留已预留窗口，新任务等待原账本到期；过大排队项结束而非永久挂起",async()=>{
 vi.useFakeTimers();const scheduler=new FontDownloadScheduler({...policy,requestsPerWindow:10,bytesPerWindow:100}),signal=new AbortController().signal;
 await scheduler.run(10,false,signal,async()=>{});scheduler.updatePolicy({...policy,requestsPerWindow:1,bytesPerWindow:100});
 const task=vi.fn(async()=>{}),next=scheduler.run(10,false,signal,task);await vi.advanceTimersByTimeAsync(999);expect(task).not.toHaveBeenCalled();expect(scheduler.snapshot.windowRequests).toBe(1);
 await vi.advanceTimersByTimeAsync(1);await next;expect(task).toHaveBeenCalledTimes(1);
 const queued=scheduler.run(10,false,signal,task),failed=expect(queued).rejects.toThrow("asset-window-size");scheduler.updatePolicy({...policy,bytesPerWindow:1});await failed;expect(scheduler.snapshot.queued).toBe(0);
});
test("墙钟前后跳变不刷新滑动窗口额度",async()=>{
 vi.useFakeTimers();const scheduler=new FontDownloadScheduler({...policy,requestsPerWindow:1}),signal=new AbortController().signal;
 await scheduler.run(1,false,signal,async()=>{});const task=vi.fn(async()=>{}),next=scheduler.run(1,false,signal,task);
 vi.setSystemTime(Date.now()+86400000);expect(scheduler.snapshot.windowRequests).toBe(1);
 await vi.advanceTimersByTimeAsync(999);expect(task).not.toHaveBeenCalled();vi.setSystemTime(Date.now()-172800000);
 await vi.advanceTimersByTimeAsync(1);await next;expect(task).toHaveBeenCalledTimes(1);
});
