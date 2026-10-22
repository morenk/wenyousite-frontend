import { afterEach, expect, test, vi } from "vitest";
import { FontTransferTimeout } from "../thread-font-transfer-timeout";
const progress = { mode: "progress", firstByteMs: 15000, idleMs: 15000, maxDurationMs: 600000 } as const;
afterEach(() => vi.useRealTimers());
test("35秒持续传输在新策略完成，旧策略仍在总15秒终止", async () => {
 vi.useFakeTimers();const demand=new AbortController(),old=new FontTransferTimeout({mode:"absolute",timeoutMs:15000},demand.signal),next=new FontTransferTimeout(progress,demand.signal);

 for(let i=0;i<7;i++){await vi.advanceTimersByTimeAsync(5000);if(!old.signal.aborted)old.bytesReceived(524288);next.bytesReceived(524288)}
 expect(old.signal.aborted).toBe(true);expect(old.signal.reason.name).toBe("TimeoutError");expect(next.signal.aborted).toBe(false);next.complete();expect(vi.getTimerCount()).toBe(0);
});
test("首个非空字节15秒未到即终止；空块不续期，后续停流也限15秒",async()=>{
 vi.useFakeTimers();const noResponse=new FontTransferTimeout(progress,new AbortController().signal);await vi.advanceTimersByTimeAsync(14000);noResponse.bytesReceived(0);await vi.advanceTimersByTimeAsync(1000);expect(noResponse.signal.aborted).toBe(true);
 const stalled=new FontTransferTimeout(progress,new AbortController().signal);await vi.advanceTimersByTimeAsync(14000);stalled.bytesReceived(1);await vi.advanceTimersByTimeAsync(10000);stalled.bytesReceived(0);await vi.advanceTimersByTimeAsync(4999);expect(stalled.signal.aborted).toBe(false);await vi.advanceTimersByTimeAsync(1);expect(stalled.signal.aborted).toBe(true);expect(vi.getTimerCount()).toBe(0);
});

test("持续进度不能续延十分钟总上限，墙钟调整也不能延长",async()=>{
 vi.useFakeTimers();const deadline=new FontTransferTimeout(progress,new AbortController().signal);
 for(let i=0;i<59;i++){await vi.advanceTimersByTimeAsync(10000);deadline.bytesReceived(1);vi.setSystemTime(Date.now()+(i%2?86400000:-86400000))}
 await vi.advanceTimersByTimeAsync(9999);expect(deadline.signal.aborted).toBe(false);await vi.advanceTimersByTimeAsync(1);expect(deadline.signal.reason.name).toBe("TimeoutError");expect(vi.getTimerCount()).toBe(0);
});
test("需求取消立即中止传输并释放定时器，完成后不保留需求或继续续期",()=>{
 vi.useFakeTimers();const demand=new AbortController(),cancelled=new FontTransferTimeout(progress,demand.signal);demand.abort();expect(cancelled.signal.reason.name).toBe("AbortError");expect(vi.getTimerCount()).toBe(0);
 const complete=new FontTransferTimeout(progress,new AbortController().signal);complete.complete();complete.bytesReceived(1);expect(vi.getTimerCount()).toBe(0);expect(complete.signal.aborted).toBe(false);
 const already=new FontTransferTimeout(progress,demand.signal);expect(already.signal.aborted).toBe(true);expect(vi.getTimerCount()).toBe(0);
});

test("事件循环迟到的数据和EOF不能绕过截止，恰好截止也拒绝",()=>{
 vi.useFakeTimers();const now=vi.spyOn(performance,"now").mockReturnValue(0);
 const idle=new FontTransferTimeout(progress,new AbortController().signal);now.mockReturnValue(15000);expect(()=>idle.bytesReceived(1)).toThrow("Font transfer timeout");
 now.mockReturnValue(0);const total=new FontTransferTimeout({...progress,firstByteMs:700000},new AbortController().signal);now.mockReturnValue(600000);expect(()=>total.check()).toThrow("Font transfer timeout");expect(vi.getTimerCount()).toBe(0);now.mockRestore();
});
