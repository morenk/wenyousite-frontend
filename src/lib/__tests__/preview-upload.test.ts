import { afterEach, expect, it, vi } from "vitest";
import { verifyPreviewUpload } from "../preview-upload";

afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });
function preview() {
  vi.stubEnv("NEXT_PUBLIC_WENYOU_PREVIEW_RUN", "preview_" + "a".repeat(24));
  vi.stubEnv("NEXT_PUBLIC_WENYOU_PREVIEW_MEDIA_ORIGIN", "http://127.0.0.1:34004");
}
it("普通环境保持现有上传流程", async () => {
  vi.stubEnv("NEXT_PUBLIC_WENYOU_PREVIEW_RUN", "");
  const request = vi.fn(); vi.stubGlobal("fetch", request);
  await verifyPreviewUpload("https://cn-nb1.rains3.com/image"); expect(request).not.toHaveBeenCalled();
});
it("预览不能向线上或带凭据的目标上传", async () => {
  preview();
  for (const url of ["https://cn-nb1.rains3.com/image", "http://user@127.0.0.1:34004/x", "http://127.0.0.1:34004/x#y"]) {
    await expect(verifyPreviewUpload(url)).rejects.toThrow("隔离预览");
  }
});
it("每次上传通过 Web 实际代理核验媒体身份", async () => {
  preview(); const run = process.env.NEXT_PUBLIC_WENYOU_PREVIEW_RUN;
  const request = vi.fn().mockResolvedValue(new Response(JSON.stringify({ role: "web", runId: run, mediaOrigin: "http://127.0.0.1:34004" }), { headers: { "x-wenyou-preview-run": run! } }));
  vi.stubGlobal("fetch", request);
  await verifyPreviewUpload("http://127.0.0.1:34004/image?signature=keep");
  expect(request).toHaveBeenCalledWith("/__preview/identity", expect.objectContaining({ redirect: "error", cache: "no-store" }));
});
it("身份丢失或媒体错误时中止", async () => {
  preview();
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("{}", { status: 503 })));
  await expect(verifyPreviewUpload("http://127.0.0.1:34004/image")).rejects.toThrow("失效");
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("{}", { headers: { "x-wenyou-preview-run": process.env.NEXT_PUBLIC_WENYOU_PREVIEW_RUN! } })));
  await expect(verifyPreviewUpload("http://127.0.0.1:34004/image")).rejects.toThrow("不匹配");
});
