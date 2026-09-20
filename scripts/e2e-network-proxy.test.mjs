import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer, request } from "node:http";
import { chromium } from "@playwright/test";
import { isolationProxy, registerMockServer } from "./e2e-network-proxy.mjs";

async function listen(handler) {
  const server = createServer(handler);
  await new Promise((ok) => server.listen(0, "127.0.0.1", ok));
  return { server, origin: `http://127.0.0.1:${server.address().port}`,
    close: () => new Promise((ok) => { server.close(ok); server.closeAllConnections(); }) };
}

test("真实 Chromium 代理保留 HTTP 缓存，隔离校验失败及未登记目标均不能写入", async () => {
  let images = 0, writes = 0, escaped = 0, checked = 0, mockWrites = 0;
  let valid = true;
  const candidate = await listen((req, res) => {
    if (req.url === "/image.svg") {
      images++; res.writeHead(200, { "Content-Type": "image/svg+xml", "Cache-Control": "public,max-age=3600" });
      res.end('<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><rect width="10" height="10"/></svg>'); return;
    }
    if (req.method === "POST") { writes++; res.end("ok"); return; }
    res.writeHead(200, { "Content-Type": "text/html" }); res.end('<img src="/image.svg">');
  });
  const trap = await listen((_req, res) => { escaped++; res.end("must-not-reach"); });
  const mock = await listen((req, res) => { if (req.method === "POST") mockWrites++; res.end("mock"); });
  registerMockServer(mock.server);
  const gate = await isolationProxy(candidate.origin, async () => { checked++; if (!valid) throw new Error("本轮身份已失效"); });
  const browser = await chromium.launch();
  try {
    const context = await browser.newContext({ proxy: { server: gate.origin } });
    const page = await context.newPage();
    await page.goto(candidate.origin);
    await page.waitForFunction(() => document.images[0].complete && document.images[0].naturalWidth > 0);
    const second = await context.newPage(); await second.goto(candidate.origin);
    await second.waitForFunction(() => document.images[0].complete && document.images[0].naturalWidth > 0);
    assert.equal(images, 1, "代理不能禁用浏览器缓存");
    await page.route("**/api/v1/write", (route) => route.continue());
    const post = (url) => page.evaluate(async (target) => (await fetch(target, { method: "POST" })).status, url);
    assert.equal(await post(candidate.origin + "/api/v1/write"), 200);
    valid = false;
    assert.equal(await post(candidate.origin + "/api/v1/write"), 403);
    assert.equal(await post(candidate.origin + "/non-api-write"), 403);
    await page.evaluate(async (target) => { await fetch(target, { method: "POST", mode: "no-cors" }).catch(() => {}); }, trap.origin + "/api/v1/write");
    assert.equal(escaped, 0, "loopback 也必须经过代理，不能触达未登记服务");
    assert.equal(writes, 1); assert.equal(checked, 2);
    await page.goto(mock.origin);
    assert.equal(await post(mock.origin + "/api/v1/mock-write"), 200);
    assert.equal(mockWrites, 1); assert.equal(checked, 2, "本进程模拟 API 不转发后端");
    assert.equal(gate.violations.length, 3);
    await context.close();
  } finally { await browser.close(); await gate.close(); await candidate.close(); await trap.close(); await mock.close(); }
});

test("关闭代理后，尚在等待身份校验的请求不得补发写入", async () => {
  let writes = 0, entered, release;
  const checking = new Promise((ok) => { entered = ok; });
  const continueCheck = new Promise((ok) => { release = ok; });
  const candidate = await listen((_req, res) => { writes++; res.end(); });
  const gate = await isolationProxy(candidate.origin, async () => { entered(); await continueCheck; });
  const proxyURL = new URL(gate.origin);
  const pending = request({ hostname: proxyURL.hostname, port: proxyURL.port, path: `${candidate.origin}/api/v1/write`, method: "POST" });
  pending.on("error", () => {}); pending.end("body");
  try {
    await checking;
    await gate.close();
    release();
    await new Promise((ok) => setImmediate(ok));
    assert.equal(writes, 0);
  } finally { release(); pending.destroy(); await candidate.close(); }
});
