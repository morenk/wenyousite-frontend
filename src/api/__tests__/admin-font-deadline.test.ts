import { afterEach, expect, test, vi } from "vitest";
import { fontSubmissionApi } from "../hooks/admin/use-admin-font-submission";
import { withAdminFontDeadline } from "../admin-font-deadline";
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });
test("恢复GET半开时有界中止，不在上传超时后永久等待", async () => {
  vi.useFakeTimers();
  const fetch = vi.spyOn(globalThis, "fetch").mockImplementation((input) => new Promise((_resolve, reject) => {
    (input as Request).signal.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")), { once: true });
  }));
  const outcome = fontSubmissionApi.read("f48fc025-1ff4-48b5-b6c2-fc9ae6517f79").catch((error: Error) => error);
  await vi.advanceTimersByTimeAsync(120000);
  expect(await outcome).toMatchObject({ message: expect.stringContaining("操作结果尚未确认") }); expect(fetch).toHaveBeenCalledOnce();
});
test("调用方取消立即传递，成功或失败均移除定时器", async () => {
  vi.useFakeTimers(); const upstream = new AbortController();
  const result = withAdminFontDeadline((signal) => new Promise<AbortSignal>((resolve) => signal.addEventListener("abort", () => resolve(signal), { once: true })), upstream.signal);
  upstream.abort(); expect((await result).aborted).toBe(true); expect(vi.getTimerCount()).toBe(0);
  await expect(withAdminFontDeadline(async () => { throw new Error("failed"); })).rejects.toThrow("failed"); expect(vi.getTimerCount()).toBe(0);
});
