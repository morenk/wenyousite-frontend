import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { adminUploadFetch } from "../upload-progress";
import { beginAdminSessionChange } from "@/lib/admin-session-store";

class FakeXhr {
  static latest: FakeXhr;
  upload = { onprogress: undefined as ((event: { loaded: number; total: number; lengthComputable: boolean }) => void) | undefined };
  onload?: () => void; onabort?: () => void; onerror?: () => void; ontimeout?: () => void;
  status = 200; statusText = "OK"; responseText = '{"ok":true}'; withCredentials = false;
  headers = new Headers(); body?: ArrayBuffer;
  constructor() { FakeXhr.latest = this; }
  open = vi.fn<(method: string, url: string) => void>();
  setRequestHeader(name: string, value: string) { this.headers.set(name, value); }
  getAllResponseHeaders() { return "Content-Type: application/json\r\nX-Request-ID: example\r\n"; }
  send = vi.fn((body: ArrayBuffer) => { this.body = body; });
  abort = vi.fn(() => this.onabort?.());
  advance(loaded: number, total = 100) { this.upload.onprogress?.({ loaded, total, lengthComputable: true }); }
}
beforeEach(() => { vi.useFakeTimers(); vi.stubGlobal("XMLHttpRequest", FakeXhr); });
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); beginAdminSessionChange(); });
async function start() {
  const progress = vi.fn();
  const response = adminUploadFetch(progress)(new Request("https://example.test/api/v1/admin/text-fonts/f/sources", { method: "POST", body: new Uint8Array([0, 255]), headers: { "X-CSRF-Token": "test-only" }, credentials: "include" }));
  // 立即安装拒绝处理器，避免假时钟期间的未处理拒绝。
  const outcome = response.then((value) => ({ value }), (error: Error) => ({ error }));
  await vi.advanceTimersByTimeAsync(0);
  return { outcome, progress, xhr: FakeXhr.latest };
}
test("真实字节事件续期无进展计时器，正常慢传可超过120秒", async () => {
  const { outcome, progress, xhr } = await start();
  await vi.advanceTimersByTimeAsync(100_000); xhr.advance(20);
  await vi.advanceTimersByTimeAsync(100_000); xhr.advance(40);
  expect(xhr.abort).not.toHaveBeenCalled(); expect(progress).toHaveBeenLastCalledWith({ loaded: 40, total: 100 });
  xhr.onload?.(); const result = await outcome; expect("value" in result && await result.value.json()).toEqual({ ok: true });
  expect(Array.from(new Uint8Array(xhr.body!))).toEqual([0, 255]); expect(xhr.withCredentials).toBe(true); expect(xhr.headers.get("X-CSRF-Token")).toBe("test-only");
  await vi.advanceTimersByTimeAsync(120_000); expect(xhr.abort).not.toHaveBeenCalled();
});
test.each([0, 100])("上传停滞或100%%后响应等待都有界（进度%s）", async (loaded) => {
  const { outcome, xhr } = await start(); xhr.advance(loaded);
  await vi.advanceTimersByTimeAsync(119_999); expect(xhr.abort).not.toHaveBeenCalled();
  xhr.advance(loaded); // 同字节事件不算实际进度。
  await vi.advanceTimersByTimeAsync(1);
  expect(xhr.abort).toHaveBeenCalledOnce(); expect(await outcome).toMatchObject({ error: { message: "上传等待超时，结果尚未确认" } });
});
test("管理会话退出立刻中止上传并清理计时器", async () => {
  const { outcome, xhr } = await start(); beginAdminSessionChange();
  expect(xhr.abort).toHaveBeenCalledOnce(); expect(await outcome).toMatchObject({ error: { name: "AbortError" } });
  await vi.advanceTimersByTimeAsync(120_000); expect(xhr.abort).toHaveBeenCalledOnce();
});

test("统一apiClient上传保持CSRF和二进制，剥离社区Bearer并携带submissionId", async () => {
  const { acceptAdminSession } = await import("@/lib/admin-session-store");
  const { setAuthSession, clearAuthSession } = await import("@/lib/auth-store");
  const { fontSubmissionApi } = await import("../hooks/admin/use-admin-font-submission");
  const generation = beginAdminSessionChange();
  acceptAdminSession({ csrfToken: "test-csrf", user: { id: "admin", role: "ADMIN" }, session: { id: "session", createdAt: "", lastActiveAt: "", expiresAt: "2099-01-01T00:00:00Z", elevatedUntil: null } }, generation);
  setAuthSession({ id: "community", username: "community", email: "test@example.test", avatar: null, role: "USER" }, "test-token");
  const request = fontSubmissionApi.upload({ submissionId: "f48fc025-1ff4-48b5-b6c2-fc9ae6517f79", familyId: "tff_" + "a".repeat(32), familyRevision: 8, name: "字体", language: "other", sortOrder: 0, authorizationRuleVersion: "admin-font-upload-v1", job: null, createdAt: "", updatedAt: "" }, new File([new Uint8Array([0, 255])], "font.otf"), vi.fn());
  await vi.advanceTimersByTimeAsync(0);
  const xhr = FakeXhr.latest;
  const url = new URL(xhr.open.mock.calls[0]![1]);
  expect(url.searchParams.get("submissionId")).toBe("f48fc025-1ff4-48b5-b6c2-fc9ae6517f79");
  expect(url.searchParams.get("expectedFamilyRevision")).toBe("8");
  expect(xhr.headers.get("X-CSRF-Token")).toBe("test-csrf"); expect(xhr.headers.has("Authorization")).toBe(false);
  expect(Array.from(new Uint8Array(xhr.body!))).toEqual([0, 255]);
  xhr.responseText = JSON.stringify({ code: 0, message: "ok", data: { jobId: "job" } }); xhr.onload?.();
  expect(await request).toMatchObject({ jobId: "job" }); clearAuthSession();
});
