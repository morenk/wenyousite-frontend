import { createServer, request } from "node:http";
import { isolatedOrigin } from "./e2e-candidate-policy.mjs";

const mockOrigins = new Map();
/** 只能登记本进程实际监听的临时模拟服务；不能用任意 URL 作为写入豁免。 */
export function registerMockServer(server) {
  const address = server.address();
  if (!server.listening || !address || typeof address === "string" || address.address !== "127.0.0.1") throw new Error("模拟服务尚未监听本机临时端口");
  const origin = isolatedOrigin(`http://127.0.0.1:${address.port}`);
  mockOrigins.set(origin, server);
  server.once("close", () => { if (mockOrigins.get(origin) === server) mockOrigins.delete(origin); });
  return origin;
}

/** 浏览器使用普通 HTTP 代理，保留缓存；独立于页面 route/mock 的最后网络门禁。 */
export async function isolationProxy(candidate, verifyWrite) {
  const target = isolatedOrigin(candidate);
  const violations = [];
  let closing = false;
  const server = createServer(async (req, res) => {
    let url;
    try { url = new URL(req.url); } catch { res.writeHead(400); res.end(); return; }
    const writes = !["GET", "HEAD"].includes(req.method ?? "");
    const mock = mockOrigins.get(url.origin)?.listening === true;
    const trusted = url.origin === target || mock;
    if (url.protocol !== "http:" || url.username || url.password || !trusted
      || (writes && !url.pathname.startsWith("/api/v1/"))) {
      // 外部匿名资源可能来自模拟界面；仍阻断，只有写入拒绝计作失败。
      if (writes) violations.push("拒绝未登记目标或非 API 写入");
      res.writeHead(403); res.end(); return;
    }
    try { if (writes && !mock) await verifyWrite(); }
    catch (error) {
      violations.push(`写入前隔离校验失败：${error instanceof Error ? error.message : "未知原因"}`);
      res.writeHead(403); res.end(); return;
    }
    if (closing || req.aborted || res.destroyed) { res.end(); return; }
    const headers = { ...req.headers, host: url.host };
    delete headers["proxy-authorization"]; delete headers["proxy-connection"];
    const upstream = request(url, { method: req.method, headers }, (incoming) => {
      res.writeHead(incoming.statusCode ?? 502, incoming.headers); incoming.pipe(res);
    });
    upstream.on("error", () => { if (!res.headersSent) res.writeHead(502); res.end(); });
    req.once("aborted", () => upstream.destroy()); res.once("close", () => upstream.destroy()); req.pipe(upstream);
  });
  // 当前候选与模拟站均为 HTTP；不建立可绕过逐请求校验的 CONNECT 隧道。
  server.on("connect", (_req, socket) => { socket.end("HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n"); });
  server.on("upgrade", (_req, socket) => socket.destroy());
  await new Promise((ok, fail) => { server.once("error", fail); server.listen(0, "127.0.0.1", ok); });
  return { origin: `http://127.0.0.1:${server.address().port}`, violations,
    close: () => new Promise((ok, fail) => { closing = true; server.close((error) => error ? fail(error) : ok()); server.closeAllConnections(); }),
  };
}
