import { afterEach, expect, it, vi } from "vitest";
import { getPreviewRun, previewBootstrap, previewFetch, previewStorageKey } from "../preview-session";
const a = "preview_" + "a".repeat(24);
const b = "preview_" + "b".repeat(24);
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); delete window.__wenyouPreview; });
function session(runId: string) { return { runId, sessionId: "test", webSessionId: "11111111-1111-4111-8111-111111111111", task: "test", webOrigin: "http://127.0.0.1:4310", mediaOrigin: "http://127.0.0.1:4312" }; }

it("文档身份不受新 bundle 环境或当前服务改变影响，认证与重试复用固定身份", async () => {
  window.__wenyouPreview = session(a);
  vi.stubEnv("NEXT_PUBLIC_WENYOU_PREVIEW_RUN", b);
  expect(getPreviewRun()).toBe(a);
  const transport = vi.fn().mockResolvedValue(new Response("{}", { headers: { "x-wenyou-preview-run": a, "x-wenyou-preview-web": "11111111-1111-4111-8111-111111111111" } }));
  await previewFetch(transport)("http://127.0.0.1:4310/api/v1/auth/refresh", { method: "POST" });
  expect((transport.mock.calls[0][0] as Request).headers.get("X-Wenyou-Preview-Run")).toBe(a);
  expect(previewStorageKey("drafts")).toBe(`drafts:${a}`);
});
it("当前服务返回新批次时拒绝响应并通知卸载旧会话", async () => {
  window.__wenyouPreview = session(a);
  const expired = vi.fn(); window.addEventListener("wenyou-preview-expired", expired);
  try {
    await expect(previewFetch(vi.fn().mockResolvedValue(new Response("{}", { headers: { "x-wenyou-preview-run": b } })))("http://127.0.0.1:4310/api/v1/test")).rejects.toThrow("已切换");
    expect(expired).toHaveBeenCalledTimes(1);
  } finally { window.removeEventListener("wenyou-preview-expired", expired); }
});
it("缺失文档身份 fail closed，普通环境不改变请求或存储", async () => {
  vi.stubEnv("NEXT_PUBLIC_WENYOU_PREVIEW_RUN", a); expect(getPreviewRun()).toBe("missing-document-identity");
  vi.stubEnv("NEXT_PUBLIC_WENYOU_PREVIEW_RUN", ""); expect(getPreviewRun()).toBe(null);
  expect(previewStorageKey("drafts")).toBe("drafts");
  const transport = vi.fn().mockResolvedValue(new Response("{}"));
  await previewFetch(transport)("https://wenyou.site/api/v1/test");
  expect(transport).toHaveBeenCalledWith("https://wenyou.site/api/v1/test", undefined);
});
it("启动脚本不可覆盖、冻结元数据且转义 HTML 结束标签", () => {
  const value = { ...session(a), task: "</script>" };
  const script = previewBootstrap(value);
  expect(script).not.toContain("</script>");
  const context: Record<string, unknown> = {};
  new Function("window", script)(context);
  new Function("window", previewBootstrap(session(b)))(context);
  expect((context.__wenyouPreview as { runId: string }).runId).toBe(a);
  expect(Object.isFrozen(context.__wenyouPreview)).toBe(true);
  expect(Object.getOwnPropertyDescriptor(context, "__wenyouPreview")?.configurable).toBe(false);
});

it("业务 409 保持正常错误处理，只有 Web 启动身份改变才失效", async () => {
  window.__wenyouPreview = session(a);
  const headers = { "x-wenyou-preview-run": a, "x-wenyou-preview-web": window.__wenyouPreview.webSessionId };
  const response = await previewFetch(vi.fn().mockResolvedValue(new Response("{}", { status: 409, headers })))("http://127.0.0.1:4310/api/v1/test");
  expect(response.status).toBe(409);
  await expect(previewFetch(vi.fn().mockResolvedValue(new Response("{}", { headers: { ...headers, "x-wenyou-preview-web": "other" } })))("http://127.0.0.1:4310/api/v1/test")).rejects.toThrow("已切换");
});

it("服务端预览请求沿同一启动环境绑定身份，普通服务端保持原行为", async () => {
  vi.stubGlobal("window", undefined);
  vi.stubEnv("WENYOU_PREVIEW_RUN", a);
  vi.stubEnv("WENYOU_PREVIEW_WEB_SESSION", "server-epoch");
  expect(getPreviewRun()).toBe(a);
  const transport = vi.fn().mockResolvedValue(new Response("{}", { headers: { "x-wenyou-preview-run": a, "x-wenyou-preview-web": "server-epoch" } }));
  await previewFetch(transport)("http://127.0.0.1:5000/api/v1/test");
  expect((transport.mock.calls[0][0] as Request).headers.get("X-Wenyou-Preview-Web")).toBe("server-epoch");
  vi.stubEnv("WENYOU_PREVIEW_RUN", ""); expect(getPreviewRun()).toBeNull();
});
