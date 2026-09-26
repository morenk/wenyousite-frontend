/** 使用本进程创建的内存模拟服务验证 Next Fast Refresh；不访问真实业务数据库。 */
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync, unlinkSync, rmdirSync } from "node:fs";
import { resolve, join } from "node:path";
import { chromium } from "@playwright/test";

const root = resolve(import.meta.dirname, "..");
const dir = join(root, ".dev-preview");
const probeDir = join(root, "src/app/preview-probe");
const probe = join(probeDir, "page.tsx");
const stateFile = join(dir, "session.json");
if (existsSync(stateFile) || existsSync(probeDir)) throw new Error("已有预览登记或探针，拒绝接管");
mkdirSync(dir, { recursive: true, mode: 0o700 }); mkdirSync(probeDir);
const descriptorFile = join(dir, "synthetic-consumer.json");
const runId = "preview_" + "d".repeat(24);
const d = { version: 1, kind: "wenyou-dev-preview", state: "ready", sessionId: "synthetic-preview", runId,
  snapshot: { capturedAt: new Date().toISOString(), businessDate: "2026-09-26", sha256: "b".repeat(64), sourceSha: "a".repeat(40), migrationVersion: "synthetic" },
  source: { backendSha: "a".repeat(40), worktree: root }, identity: { header: "X-Wenyou-Preview-Run", value: runId }, ownership: { uid: process.getuid(), resourceId: runId } };
const servers = []; let broken = false; let browser; let started = false;
async function cli(command, task = "preview-selftest", extra = []) {
  const child = spawn(process.execPath, ["scripts/dev-preview.mjs", command, "--task", task, "--descriptor", descriptorFile, ...extra], { cwd: root, stdio: ["ignore", "pipe", "pipe"] });
  let output = "", errors = ""; child.stdout.on("data", (v) => output += v); child.stderr.on("data", (v) => errors += v);
  const code = await new Promise((ok, fail) => { child.on("exit", ok); child.on("error", fail); });
  if (code !== 0) throw new Error(errors); return JSON.parse(output);
}
function page(round) {
  return `'use client';
import { useState } from 'react';
export default function PreviewProbe() { const [text, setText] = useState(''); return <section style={{ padding: '${24 + round}px', borderRadius: '${8 + round}px' }}><h1>preview-round-${round}</h1><label>State<input aria-label="State" value={text} onChange={e => setText(e.target.value)} /></label></section>; }
`;
}
try {
  for (const role of ["backend", "media", "web"]) {
    const server = createServer((req, res) => {
      if (req.url === "/__preview/identity") {
        res.writeHead(200, { "Content-Type": "application/json", "X-Wenyou-Preview-Run": broken ? "wrong" : runId });
        res.end(JSON.stringify({ version: 1, kind: d.kind, sessionId: d.sessionId, runId, role, resourceId: runId, snapshotSha256: d.snapshot.sha256 }));
      } else { res.writeHead(401, { "Content-Type": "application/json", "X-Wenyou-Preview-Run": runId }); res.end(JSON.stringify({ code: 401, message: "synthetic unauthorized" })); }
    });
    await new Promise((ok, fail) => { server.once("error", fail); server.listen({ web: 14310, backend: 14311, media: 14312 }[role], "127.0.0.1", ok); });
    const port = server.address().port; const origin = `http://127.0.0.1:${port}`;
    d[role] = { port, origin, ...(role !== "web" ? { identityUrl: `${origin}/__preview/identity` } : {}), ...(role === "backend" ? { apiBase: `${origin}/api/v1` } : {}) };
    servers.push(server);
  }
  writeFileSync(descriptorFile, JSON.stringify(d), { mode: 0o600 }); writeFileSync(probe, page(0));
  await assert.rejects(cli("start"), /EADDRINUSE/);
  await new Promise((ok) => servers.pop().close(ok));
  const first = await cli("start"); started = true; assert.equal(first.status, "ready");
  assert.equal((await cli("start")).runId, runId);
  await assert.rejects(cli("pause", "preview-selftest", ["--confirm", "preview_" + "f".repeat(24)]), /runId 已变化/);
  const listed = await cli("list");
  assert.ok(listed.sessions.some((item) => item.worktree === root && item.processAlive && item.runId === runId));
  await assert.rejects(cli("stop", "another-task"), /其他任务/);
  browser = await chromium.launch({ headless: true });
  const tab = await browser.newPage({ viewport: { width: 1280, height: 850 } });
  await tab.goto(`${d.web.origin}/preview-probe`); await tab.getByRole("heading", { name: "preview-round-0" }).waitFor();
  await tab.getByRole("textbox", { name: "State" }).fill("kept-through-refresh");
  await tab.evaluate(() => { window.previewMarker = "same-document"; });
  assert.equal(await tab.evaluate(() => window.__wenyouPreview.runId), runId);
  assert.equal(await tab.evaluate(() => window.__wenyouPreview.webSessionId), first.webSessionId);
  const digests = [];
  for (const round of [1, 2, 3]) {
    writeFileSync(probe, page(round));
    await tab.getByRole("heading", { name: `preview-round-${round}` }).waitFor({ timeout: 30000 });
    assert.equal(await tab.getByRole("textbox", { name: "State" }).inputValue(), "kept-through-refresh");
    assert.equal(await tab.evaluate(() => window.previewMarker), "same-document");
    digests.push((await cli("status")).sourceDigest);
  }
  assert.equal(new Set(digests).size, 3);
  assert.equal(await tab.evaluate(() => window.__wenyouPreview.webSessionId), first.webSessionId);
  assert.equal(await tab.evaluate(async () => (await fetch("/api/v1/write", { method: "POST" })).status), 409);
  assert.equal(await tab.evaluate(async () => (await fetch("/api/v1/write", { method: "POST", headers: { "X-Wenyou-Preview-Run": window.__wenyouPreview.runId, "X-Wenyou-Preview-Web": "22222222-2222-4222-8222-222222222222" } })).status), 409);
  await tab.screenshot({ path: join(dir, "fast-refresh-light.png") });
  await tab.emulateMedia({ colorScheme: "dark" }); await tab.setViewportSize({ width: 900, height: 760 });
  await tab.screenshot({ path: join(dir, "fast-refresh-dark.png") });
  broken = true; assert.equal((await cli("status")).status, "unavailable");
  const api = await fetch(`${d.web.origin}/api/v1/health`, { headers: { "X-Wenyou-Preview-Run": runId, "X-Wenyou-Preview-Web": first.webSessionId } }); assert.equal(api.status, 503);
  broken = false; assert.equal((await cli("status")).status, "ready");
  await browser.close(); browser = null;
  // supervisor 异常退出后不接管残留 Next，stop 仍只清理精确登记的任务进程。
  process.kill(JSON.parse(readFileSync(stateFile)).supervisor.pid, "SIGKILL");
  await new Promise((ok) => setTimeout(ok, 100));
  assert.equal((await cli("status")).status, "unavailable");
  await cli("stop"); started = false; assert.equal((await cli("status")).status, "stopped");
  assert.ok(existsSync(stateFile)); assert.ok(existsSync(descriptorFile));
  const resumed = await cli("start"); started = true;
  assert.notEqual(resumed.webSessionId, first.webSessionId);
  const rejected = await fetch(`${d.web.origin}/api/v1/write`, { method: "POST", headers: { "X-Wenyou-Preview-Run": runId, "X-Wenyou-Preview-Web": first.webSessionId } });
  assert.equal(rejected.status, 409);
  const running = JSON.parse(readFileSync(stateFile));
  assert.ok(running.members.some((item) => item.pid !== running.next.pid));
  process.kill(running.next.pid, "SIGKILL");
  for (let attempt = 0; attempt < 40; attempt++) {
    await new Promise((ok) => setTimeout(ok, 250));
    if ((await cli("status")).status === "stopped") break;
  }
  assert.equal((await cli("status")).status, "stopped");
  await assert.rejects(fetch(`${d.web.origin}/__preview/identity`));
  await cli("stop"); started = false;
  // 只清理本探针已停止的登记；正常 CLI stop 保留登记与用户数据。
  assert.equal(JSON.parse(readFileSync(stateFile)).task, "preview-selftest"); unlinkSync(stateFile);
  writeFileSync(join(dir, "live-test.json"), JSON.stringify({ kind: "synthetic-fast-refresh", rounds: 3, preservedInput: true, sameDocument: true, digests, wrongTaskRejected: true, staleRunConfirmRejected: true, documentIdentityFrozen: true, missingHeadersRejected: true, sameRunOldWebRejected: true, portConflictRejected: true, runtimeDisconnectBlocked: true, abnormalExitRecovered: true, nextLeaderExitCleaned: true, cleaned: true }, null, 2));
  console.log("3 rounds Fast Refresh: same document/input retained; conflict, ownership, disconnect and stop guards passed (synthetic services only)");
} finally {
  await browser?.close();
  if (started) await cli("stop");
  await Promise.all(servers.map((server) => new Promise((ok) => { server.close(ok); server.closeAllConnections(); })));
  if (existsSync(probe)) unlinkSync(probe); rmdirSync(probeDir);
  if (existsSync(descriptorFile)) unlinkSync(descriptorFile);
}
