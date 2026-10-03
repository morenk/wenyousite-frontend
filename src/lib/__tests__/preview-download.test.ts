import { afterEach, expect, test, vi } from "vitest";
import { appDownloadOrigin } from "../preview-download";
import { androidDownloadPath } from "../app-download";
import { downloadRelease } from "@/test/app-download";

afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });
const runId = "preview_" + "a".repeat(24);
const identity = { role: "web", runId, resourceId: runId, backendOrigin: "http://127.0.0.1:34585" };

test("普通环境只接受本站 URL，不发开发身份请求", async () => {
  vi.stubEnv("NEXT_PUBLIC_WENYOU_PREVIEW_RUN", "");
  const request = vi.fn(); vi.stubGlobal("fetch", request);
  expect(await appDownloadOrigin()).toBe("https://wenyou.site"); expect(request).not.toHaveBeenCalled();
});

test("隔离预览以实际代理身份校验来源，下载仍只产生同源路径", async () => {
  vi.stubEnv("NEXT_PUBLIC_WENYOU_PREVIEW_RUN", runId);
  const request = vi.fn().mockResolvedValue(new Response(JSON.stringify(identity), { headers: { "x-wenyou-preview-run": runId } }));
  vi.stubGlobal("fetch", request);
  const origin = await appDownloadOrigin(new AbortController().signal);
  expect(origin).toBe(identity.backendOrigin);
  const release = { ...downloadRelease(), downloadUrl: `${origin}/api/v1/app-downloads/android/42/file` };
  expect(androidDownloadPath(release, origin)).toBe("/api/v1/app-downloads/android/42/file");
  expect(() => androidDownloadPath(release)).toThrow();
  expect(request).toHaveBeenCalledWith("/__preview/identity", expect.objectContaining({ redirect: "error", cache: "no-store" }));
});

test("身份不匹配、线上端口、其他地址或不可用时失败关闭", async () => {
  vi.stubEnv("NEXT_PUBLIC_WENYOU_PREVIEW_RUN", runId);
  for (const patch of [{ role: "backend" }, { runId: "wrong" }, { resourceId: "wrong" },
    ...["https://wenyou.site", "http://127.0.0.1:3000", "http://127.0.0.1:3001", "http://127.0.0.1:80", "http://127.0.0.1:34585/x", "http://user@127.0.0.1:34585", "http://example.com:34585", "invalid"].map(backendOrigin => ({ backendOrigin }))]) {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ ...identity, ...patch }), { headers: { "x-wenyou-preview-run": runId } })));
    await expect(appDownloadOrigin()).rejects.toThrow();
  }
  for (const init of [{ status: 503 }, { headers: { "x-wenyou-preview-run": "wrong" } }]) {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify(identity), init)));
    await expect(appDownloadOrigin()).rejects.toThrow("失效");
  }
});
