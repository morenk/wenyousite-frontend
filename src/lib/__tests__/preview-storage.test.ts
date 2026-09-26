import { IDBFactory } from "fake-indexeddb";
import { afterEach, expect, it, vi } from "vitest";
import type { PreviewSession } from "../preview-session";
afterEach(() => { vi.unstubAllGlobals(); delete window.__wenyouPreview; localStorage.clear(); vi.resetModules(); });
function useRun(char: string) {
  window.__wenyouPreview = { runId: "preview_" + char.repeat(24), sessionId: "test", task: "test", webSessionId: "public-epoch", webOrigin: "http://127.0.0.1:4310", mediaOrigin: "http://127.0.0.1:4312" } satisfies PreviewSession;
  vi.resetModules();
}
it("固定 origin 下批次 B 不继承 A 草稿或认证标记，返回 A 仍保留数据", async () => {
  vi.stubGlobal("indexedDB", new IDBFactory());
  useRun("a");
  const a = await import("../moment-draft");
  const authA = await import("../auth-store");
  const record = { userId: "same-user", title: "A 草稿", content: "A 内容", files: [], coverFileId: null, updatedAt: Date.now() };
  await a.saveMomentDraft(record);
  authA.setAuthSession({ id: "same-user", username: "test", email: "test@example.test", avatar: null, role: "USER" }, "memory-only");
  useRun("b");
  const b = await import("../moment-draft");
  const authB = await import("../auth-store");
  await expect(b.loadMomentDraft("same-user")).resolves.toBeNull();
  expect(authB.readSessionMarkerUserId()).toBeNull();
  expect(authB.getAuthAccessToken()).toBeNull();
  await b.saveMomentDraft({ ...record, title: "B 草稿" });
  useRun("a");
  const resumed = await import("../moment-draft");
  const authResumed = await import("../auth-store");
  await expect(resumed.loadMomentDraft("same-user")).resolves.toMatchObject({ title: "A 草稿" });
  expect(authResumed.readSessionMarkerUserId()).toBe("same-user");
  expect(authResumed.getAuthAccessToken()).toBeNull();
});
