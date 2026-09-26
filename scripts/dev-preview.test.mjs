import assert from "node:assert/strict";
import { createServer } from "node:http";
import { test } from "node:test";
import { validateDescriptor, previewConfig, verifyRuntime, previewOrigin } from "./dev-preview-policy.mjs";
import { previewProxy } from "./dev-preview-proxy.mjs";
import { assertAvailable, assertOperationLocks, inspectSession } from "./dev-preview-registry.mjs";

function descriptor() {
  const service = (port) => ({ port, origin: `http://127.0.0.1:${port}`, identityUrl: `http://127.0.0.1:${port}/__preview/identity` });
  return { version: 1, kind: "wenyou-dev-preview", state: "ready", sessionId: "preview-test", runId: "preview_" + "a".repeat(24),
    snapshot: { capturedAt: "2026-09-26T01:00:00Z", businessDate: "2026-09-26", sha256: "b".repeat(64), sourceSha: "c".repeat(40), migrationVersion: "1" },
    source: { backendSha: "c".repeat(40), worktree: "/test" }, backend: { ...service(35002), apiBase: "http://127.0.0.1:35002/api/v1" },
    media: service(35003), web: { port: 35004, origin: "http://127.0.0.1:35004" }, identity: { header: "X-Wenyou-Preview-Run", value: "preview_" + "a".repeat(24) }, ownership: { uid: 1000, resourceId: "preview_" + "a".repeat(24) } };
}
test("缺少描述、线上目标、端口复用和错身份全部拒绝", () => {
  assert.throws(() => validateDescriptor({}));
  for (const url of ["http://127.0.0.1:3000", "http://127.0.0.1:3001", "http://127.0.0.1:5432", "http://127.0.0.1:6379", "http://localhost:35002", "http://example.com:35002", "http://127.0.0.1:35002/x", "http://user@127.0.0.1:35002"]) assert.throws(() => previewOrigin(url));
  assert.equal(validateDescriptor(descriptor()).version, 1);
  for (const mutate of [(d) => { d.backend.apiBase = "http://127.0.0.1:3000/api/v1"; }, (d) => { d.identity.value = "wrong"; }, (d) => { d.media = d.backend; }, (d) => { d.snapshot.sha256 = "wrong"; }]) { const d = descriptor(); mutate(d); assert.throws(() => validateDescriptor(d)); }
});
test("独立预览配置不能混入生产或 E2E，输出只含公开元数据", () => {
  assert.equal(previewConfig({}), null);
  const env = { NODE_ENV: "development", WENYOU_PREVIEW_RUN: descriptor().runId, WENYOU_PREVIEW_SESSION: "preview-test", WENYOU_PREVIEW_SNAPSHOT: "2026-09-26T01:00:00Z", WENYOU_PREVIEW_MEDIA_ORIGIN: "http://127.0.0.1:35003", BACKEND_URL: "http://127.0.0.1:35005" };
  assert.equal(previewConfig(env).mediaOrigin, env.WENYOU_PREVIEW_MEDIA_ORIGIN);
  assert.throws(() => previewConfig({ ...env, NODE_ENV: "production" }));
  assert.throws(() => previewConfig({ ...env, WENYOU_E2E_CANDIDATE_ID: "other" }));
  assert.throws(() => previewConfig({ ...env, BACKEND_URL: undefined }));
});
test("逐请求核验真实资源，阻止身份切换、重定向和未登记响应", async () => {
  const d = descriptor(); let broken = false; let writes = 0; let redirect = false; let responseIdentity = true;
  const servers = [];
  for (const role of ["backend", "media"]) {
    const server = createServer((req, res) => {
      res.setHeader("Content-Type", "application/json");
      if (req.url === "/__preview/identity") {
        res.setHeader("X-Wenyou-Preview-Run", broken ? "wrong" : d.runId);
        res.end(JSON.stringify({ version: 1, kind: d.kind, sessionId: d.sessionId, runId: d.runId, role, resourceId: d.runId, snapshotSha256: d.snapshot.sha256 })); return;
      }
      assert.equal(req.headers["x-wenyou-preview-run"], d.runId); writes++;
      if (responseIdentity) res.setHeader("X-Wenyou-Preview-Run", d.runId);
      if (redirect) { res.statusCode = 307; res.setHeader("Location", "http://127.0.0.1:3000"); }
      res.end(JSON.stringify({ accepted: true }));
    });
    await new Promise((ok) => server.listen(0, "127.0.0.1", ok));
    const port = server.address().port;
    d[role] = { port, origin: `http://127.0.0.1:${port}`, identityUrl: `http://127.0.0.1:${port}/__preview/identity`, ...(role === "backend" ? { apiBase: `http://127.0.0.1:${port}/api/v1` } : {}) }; servers.push(server);
  }
  const webSessionId = "11111111-1111-4111-8111-111111111111";
  let proxy;
  try {
    proxy = await previewProxy(d, webSessionId);
    const identity = await fetch(`${proxy.origin}/__preview/identity`); assert.equal((await identity.json()).runId, d.runId);
    assert.equal((await fetch(`${proxy.origin}/api/v1/write`, { method: "POST", body: "test" })).status, 409);
    assert.equal((await fetch(`${proxy.origin}/api/v1/write`, { method: "POST", headers: { "X-Wenyou-Preview-Run": "preview_" + "f".repeat(24) }, body: "old-document" })).status, 409);
    assert.equal((await fetch(`${proxy.origin}/api/v1/write`, { method: "POST", headers: { "X-Wenyou-Preview-Run": d.runId, "X-Wenyou-Preview-Web": "22222222-2222-4222-8222-222222222222" } })).status, 409);
    assert.equal(writes, 0);
    assert.equal((await fetch(`${proxy.origin}/api/v1/write`, { method: "POST", headers: { "X-Wenyou-Preview-Run": d.runId, "X-Wenyou-Preview-Web": webSessionId }, body: "test" })).status, 200); assert.equal(writes, 1);
    broken = true;
    assert.equal((await fetch(`${proxy.origin}/api/v1/write`, { method: "POST", headers: { "X-Wenyou-Preview-Run": d.runId, "X-Wenyou-Preview-Web": webSessionId } })).status, 503); assert.equal(writes, 1);
    assert.equal((await fetch(`${proxy.origin}/__preview/identity`)).status, 503);
    broken = false; redirect = true;
    assert.equal((await fetch(`${proxy.origin}/api/v1/write`, { headers: { "X-Wenyou-Preview-Run": d.runId, "X-Wenyou-Preview-Web": webSessionId } })).status, 502);
    redirect = false; responseIdentity = false;
    assert.equal((await fetch(`${proxy.origin}/api/v1/write`, { headers: { "X-Wenyou-Preview-Run": d.runId, "X-Wenyou-Preview-Web": webSessionId } })).status, 502);
    assert.equal((await fetch(`${proxy.origin}/other`)).status, 404);
    await assert.rejects(verifyRuntime(d, "backend", async () => new Response("{}", { status: 302 })));
    await assert.rejects(verifyRuntime(d, "backend", async () => new Response("{}", { headers: { "content-type": "application/json", "x-wenyou-preview-run": d.runId } })));
  } finally { await proxy?.close(); await Promise.all(servers.map((server) => new Promise((ok) => { server.close(ok); server.closeAllConnections(); }))); }
});

test("跨 Worktree 登记严格检查活进程归属，失活保留数据，损坏登记阻止切换", () => {
  const process = { pid: 123, ticks: "100", group: 123, session: 123, cwd: "/owner" };
  const state = { task: "owner", worktree: "/owner", consumer: descriptor(), status: "ready", supervisor: process };
  assert.deepEqual([inspectSession(state, "/owner", () => process).processAlive, inspectSession(state, "/owner", () => process).blocked], [true, false]);
  assert.equal(inspectSession(state, "/owner", () => null).state, "stopped");
  for (const change of [{ ticks: "101" }, { cwd: "/another" }, { group: 456 }, { session: 456 }]) {
    const result = inspectSession(state, "/owner", () => ({ ...process, ...change }));
    assert.equal(result.blocked, true); assert.equal(result.state, "ownership-conflict");
  }
  assert.equal(inspectSession(null, "/owner").blocked, true);
});

test("历史动态端口活会话也阻止其他 Worktree 启动，不抢占其他任务", () => {
  const sessions = [{ task: "legacy", worktree: "/old", runId: descriptor().runId, state: "ready", processAlive: true, blocked: false, ports: { web: 35004 } }];
  assert.throws(() => assertAvailable(sessions, "/new"), /legacy/);
  assert.doesNotThrow(() => assertAvailable(sessions, "/old"));
  assert.doesNotThrow(() => assertAvailable([{ ...sessions[0], processAlive: false }], "/new"));
  assert.throws(() => assertAvailable([{ ...sessions[0], processAlive: false, blocked: true }], "/new"), /归属冲突/);
});

test("直接调用内部标记不能代替真正持有生命周期锁", () => {
  assert.throws(() => assertOperationLocks(process.cwd()), /flock/);
});
