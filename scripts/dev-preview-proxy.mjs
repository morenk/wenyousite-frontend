import { createServer, request } from "node:http";
import { validateDescriptor, verifyRuntime } from "./dev-preview-policy.mjs";

export async function previewProxy(input) {
  const descriptor = validateDescriptor(input);
  const verify = () => Promise.all([verifyRuntime(descriptor, "backend"), verifyRuntime(descriptor, "media")]);
  await verify();
  const server = createServer(async (req, res) => {
    try {
      if (!req.url?.startsWith("/") || req.url.startsWith("//") || req.url.includes("\\")) throw new Error("无效路径");
      const url = new URL(req.url, descriptor.backend.origin);
      const identity = url.pathname === "/__preview/identity" && req.method === "GET";
      if (!identity && !url.pathname.startsWith("/api/v1/")) { res.writeHead(404); res.end(); return; }
      await verify();
      if (identity) {
        res.writeHead(200, { "Content-Type": "application/json", "Cache-Control": "no-store", "X-Wenyou-Preview-Run": descriptor.runId });
        res.end(JSON.stringify({ version: 1, kind: descriptor.kind, role: "web", sessionId: descriptor.sessionId,
          runId: descriptor.runId, resourceId: descriptor.runId, snapshotSha256: descriptor.snapshot.sha256,
          backendOrigin: descriptor.backend.origin, mediaOrigin: descriptor.media.origin, webOrigin: descriptor.web.origin }));
        return;
      }
      const headers = { ...req.headers, host: url.host, "x-wenyou-preview-run": descriptor.runId };
      delete headers["proxy-authorization"]; delete headers["proxy-connection"];
      const upstream = request(url, { method: req.method, headers }, (incoming) => {
        if (incoming.headers["x-wenyou-preview-run"] !== descriptor.runId || (incoming.statusCode >= 300 && incoming.statusCode < 400)) {
          incoming.destroy(); res.writeHead(502); res.end("预览 API 响应身份不匹配或发生重定向"); return;
        }
        res.writeHead(incoming.statusCode ?? 502, incoming.headers); incoming.pipe(res);
      });
      upstream.setTimeout(30000, () => upstream.destroy());
      upstream.once("error", () => { if (!res.headersSent) res.writeHead(502); res.end("预览后端连接已关闭"); });
      req.once("aborted", () => upstream.destroy()); res.once("close", () => upstream.destroy()); req.pipe(upstream);
    } catch {
      if (!res.headersSent) res.writeHead(503, { "Cache-Control": "no-store" });
      res.end("隔离预览身份核验失败，已停止代理请求");
    }
  });
  server.on("connect", (_req, socket) => socket.destroy());
  server.on("upgrade", (_req, socket) => socket.destroy());
  await new Promise((ok, fail) => { server.once("error", fail); server.listen(0, "127.0.0.1", ok); });
  return { origin: `http://127.0.0.1:${server.address().port}`, close: () => new Promise((ok) => {
    server.close(ok); server.closeAllConnections();
  }) };
}
