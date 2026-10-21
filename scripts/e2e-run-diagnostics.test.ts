import { mkdtempSync, readFileSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, expect, test } from "vitest";
import { runDiagnostics, runEventIdentity, runFailureCategory } from "./e2e-run-diagnostics.mjs";
const roots: string[] = [];
afterEach(() => roots.splice(0).forEach(root => rmSync(root, { recursive: true })));
const resource = { event: "resources-verified", runId: "e2e_" + "a".repeat(24), root: "/tmp/wenyousite-e2e-Ab1234", uid: process.getuid!() };
test("ready前已登记身份及清理事件仍可恢复，不把未收到事件视为无资源", () => {
  expect(runEventIdentity([resource, { ...resource, event: "resources-cleaned" }], resource.uid)).toEqual({ runId: resource.runId, root: resource.root, ready: false });
  expect(runEventIdentity([], resource.uid)).toBeUndefined();
  for (const mismatch of [{ runId: "e2e_" + "b".repeat(24) }, { root: "/tmp/wenyousite-e2e-Zz1234" }, { uid: resource.uid + 1 }, { root: "/srv/wenyousite" }]) {
    expect(() => runEventIdentity([resource, { ...resource, ...mismatch }], resource.uid)).toThrow();
  }
  expect(() => runEventIdentity([resource, { event: "ready", runId: resource.runId, manifestPath: "/tmp/other/manifest.json" }], resource.uid)).toThrow();
});
test("stdout和stderr分块事件均可读取，原始内容只进入0600有界私有文件", () => {
  const root = mkdtempSync(join(tmpdir(), "web-e2e-diagnostic-")); roots.push(root);
  const path = join(root, "run.private.log");
  const log = runDiagnostics(path, 512);
  const line = JSON.stringify(resource) + "\n";
  log.append("stdout", Buffer.from(line.slice(0, 15)));
  log.append("stderr", Buffer.from('private test secret\n'));
  log.append("stdout", Buffer.from(line.slice(15)));
  log.append("stderr", Buffer.from(JSON.stringify({ event: "startup-failed", runId: resource.runId }) + "\n"));
  log.append("stderr", Buffer.from("x".repeat(2000)));
  expect(statSync(path).mode & 0o777).toBe(0o600);
  expect(readFileSync(path).length).toBe(512);
  expect(log.events.map(e => e.event)).toEqual(["resources-verified", "startup-failed"]);
  expect(JSON.stringify(log.events)).not.toContain("private test secret");
});
test("固定错误分类区分主动停止、启动、构建与浏览器失败", () => {
  expect(runFailureCategory({ interrupted: true, ready: false, tests: 0, success: false })).toBe("interrupted");
  expect(runFailureCategory({ interrupted: false, ready: false, tests: 0, success: false })).toBe("backend-startup-failed");
  expect(runFailureCategory({ interrupted: false, ready: true, tests: 0, success: false })).toBe("candidate-preparation-failed");
  expect(runFailureCategory({ interrupted: false, ready: true, tests: 1, success: false })).toBe("browser-tests-failed");
});
