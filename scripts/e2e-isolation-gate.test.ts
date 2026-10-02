// @vitest-environment node
import { afterEach, describe, expect, test, vi } from "vitest";
import { chmodSync, mkdtempSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createServer } from "node:http";
import { http, passthrough } from "msw";
import { server as mockServer } from "../src/test/msw/server";
import { assertResourceProcesses, privateJSON, readDiscussionFixtures, readAdminFixtures, readMobileReleaseFixtures, readIsolation, requireIsolationRunner, verifyRunProfile } from "./e2e-isolation-gate.mjs";
import { sanitize } from "./e2e-safe-reporter";

const roots: string[] = [];
const runId = "e2e_" + "1".repeat(24);
const json = (path: string, value: unknown) => writeFileSync(path, JSON.stringify(value), { mode: 0o600 });
function fixture() {
  const root = mkdtempSync(join(tmpdir(), "web-isolation-test-")); roots.push(root); chmodSync(root, 0o700);
  mkdirSync(join(root, "uploads"));
  const env = { E2E_MANIFEST: join(root, "manifest.json"), E2E_RUN_ID: runId, E2E_PRIVATE_ENV: join(root, "private.env.json"), E2E_BACKEND_URL: "http://127.0.0.1:39000", API_BASE: "http://127.0.0.1:39000/api/v1" };
  const own = { runId, root, uid: process.getuid!() };
  json(join(root, "ownership.json"), own);
  json(join(root, "resources.json"), { ...own, postgresPid: 100, redisPid: 101, pgPort: 39001, redisPort: 39002, redisInstance: "a".repeat(40) });
  json(env.E2E_MANIFEST, { version: 1, runId, state: "ready", backendURL: env.E2E_BACKEND_URL, apiBase: env.API_BASE,
    privateEnvPath: env.E2E_PRIVATE_ENV, resourcesPath: join(root, "resources.json"), uploadPath: join(root, "uploads"),
    postgres: { host: "127.0.0.1", port: 39001, database: `wenyousite_${runId}`, clusterName: runId },
    redis: { host: "127.0.0.1", port: 39002, instanceId: "a".repeat(40) } });
  json(env.E2E_PRIVATE_ENV, { ...env, E2E_USER_ID: "fake-id", E2E_USERNAME: "fake-user", E2E_EMAIL: "fake@e2e.invalid", E2E_PASSWORD: "fake-password" });
  return { root, env };
}
afterEach(() => { vi.restoreAllMocks(); roots.splice(0).forEach((root) => rmSync(root, { recursive: true, force: true })); });

describe("隔离 manifest 与真实资源门禁", () => {
  test("HEAD成功后资料超时仍拒绝，诊断不复用HEAD状态或输出账号", async () => {
    const run = readIsolation(fixture().env);
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(new Response(null, { headers: { "x-wenyou-e2e-candidate": "current-candidate" } }))
      .mockRejectedValueOnce(new DOMException("sensitive response", "TimeoutError"));
    const error = await verifyRunProfile(run, "http://127.0.0.1:39001", "current-candidate").catch((error: Error) => error);
    if (!(error instanceof Error)) throw new Error("必须拒绝未核验的身份");
    expect(error.message).toContain("阶段 profile-fetch，HTTP 不可达");
    expect(error.message).toContain("ID匹配 unread");
    expect(error.message).toContain("原因 TimeoutError");
    expect(error.message).not.toMatch(/HTTP 200|sensitive|fake-user|fake-id/);
  });
  test("错误资料仅记录匹配布尔并拒绝写入，不输出响应正文", async () => {
    const run = readIsolation(fixture().env);
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ data: { id: "wrong-id", username: "secret-name" } }), { headers: { "content-type": "application/json" } }));
    const error = await verifyRunProfile(run, "http://127.0.0.1:39001").catch((error: Error) => error);
    if (!(error instanceof Error)) throw new Error("必须拒绝错误的身份");
    expect(error.message).toContain("阶段 profile-match，HTTP 200");
    expect(error.message).toContain("ID匹配 false，用户名匹配 false");
    expect(error.message).not.toMatch(/wrong-id|secret-name|fake-user/);
  });
  test("讨论样本须同轮私有文件且只含测试ID，拒绝越界路径和凭据", () => {
    const { env: baseEnv, root } = fixture();
    const path = join(root, "discussion-fixtures.json");
    const env = { ...baseEnv, E2E_DISCUSSION_FIXTURES: path };
    json(env.E2E_PRIVATE_ENV, { ...privateJSON(env.E2E_PRIVATE_ENV), E2E_DISCUSSION_FIXTURES: path });
    const item = { threadId: "thread", subthreadId: "sub", rootPostId: "root", pinnedPostId: "pin", editableFloorId: "floor", editableReplyId: "reply", otherAuthorFloorId: "other-floor", otherAuthorReplyId: "other-reply" };
    const body = { version: 1, runId, ownerUserId: "fake-id", otherUserId: "other", scenarios: [1000, 5000, 10000].map((size) => ({ ...item, size })) };
    json(path, body);
    expect(readDiscussionFixtures(readIsolation(env)).scenarios).toHaveLength(3);
    expect(() => readIsolation(baseEnv)).toThrow(/未绑定/);
    json(path, { ...body, runId: "old-run" });
    expect(() => readDiscussionFixtures(readIsolation(env))).toThrow(/身份/);
    json(path, { ...body, DATABASE_URL: "forbidden" });
    expect(() => readDiscussionFixtures(readIsolation(env))).toThrow(/越界/);
    json(path, body); chmodSync(path, 0o644);
    expect(() => readDiscussionFixtures(readIsolation(env))).toThrow(/0600/);
  });
  test("版本样本必须绑定本轮私有文件和预期发布状态", () => {
    const { env: baseEnv, root } = fixture();
    const path = join(root, "mobile-release-fixtures.json");
    const env = { ...baseEnv, E2E_MOBILE_RELEASE_FIXTURES: path };
    json(env.E2E_PRIVATE_ENV, { ...privateJSON(env.E2E_PRIVATE_ENV), E2E_MOBILE_RELEASE_FIXTURES: path });
    const published = { id: "published", platform: "android", status: "PUBLISHED", buildNumber: 100, revision: 1 };
    const body = { version: 1, runId, published, draft: { ...published, id: "draft", status: "DRAFT", buildNumber: 101 } };
    json(path, body);
    expect(readMobileReleaseFixtures(readIsolation(env)).published.buildNumber).toBe(100);
    expect(() => readIsolation(baseEnv)).toThrow(/未绑定/);
    json(path, { ...body, runId: "previous-run" });
    expect(() => readMobileReleaseFixtures(readIsolation(env))).toThrow(/身份/);
    json(path, { ...body, published: { ...published, status: "READY" } });
    expect(() => readMobileReleaseFixtures(readIsolation(env))).toThrow(/状态/);
    json(path, body); chmodSync(path, 0o644);
    expect(() => readMobileReleaseFixtures(readIsolation(env))).toThrow(/0600/);
  });
  test("管理账号与私有收件箱必须来自本轮，敏感诊断脱敏", () => {
    const { env: baseEnv, root } = fixture();
    const path = join(root, "admin-fixtures.json");
    const env = { ...baseEnv, E2E_ADMIN_FIXTURES: path };
    const credentials = privateJSON(env.E2E_PRIVATE_ENV);
    json(env.E2E_PRIVATE_ENV, { ...credentials, E2E_ADMIN_FIXTURES: path });
    const mailboxPath = join(root, "admin-mailbox"); mkdirSync(mailboxPath, { mode: 0o700 });
    const accounts = ["ADMIN", "SUPER_ADMIN"].map((role) => ({ role, userId: role, email: `${role}@e2e.invalid`, password: `${role}-password` }));
    const body = { version: 1, runId, mailboxPath, accounts };
    json(path, body);
    expect(readAdminFixtures(readIsolation(env)).accounts).toHaveLength(2);
    expect(sanitize("ADMIN@e2e.invalid SUPER_ADMIN-password", { ...env, NODE_ENV: "test" })).not.toMatch(/@e2e.invalid|password/);
    expect(() => readIsolation(baseEnv)).toThrow(/未绑定/);
    json(path, { ...body, runId: "old-run" });
    expect(() => readAdminFixtures(readIsolation(env))).toThrow(/身份/);
    json(path, { ...body, accounts: [{ ...accounts[0], DATABASE_URL: "forbidden" }, accounts[1]] });
    expect(() => readAdminFixtures(readIsolation(env))).toThrow(/越界/);
    json(path, body); chmodSync(mailboxPath, 0o755);
    expect(() => readAdminFixtures(readIsolation(env))).toThrow(/收件箱/);
    expect(sanitize("SUPER_ADMIN-password", { ...env, NODE_ENV: "test" })).toBe("隔离管理账号身份不可核验，诊断已隐藏");
  });
  test("只接受私有、同轮、地址与资源一致的登记", () => {
    const { env } = fixture();
    expect(readIsolation(env).manifest.runId).toBe(runId);
    expect(() => readIsolation({ ...env, E2E_RUN_ID: "e2e_" + "2".repeat(24) })).toThrow();
    expect(() => readIsolation({ ...env, E2E_BACKEND_URL: "http://127.0.0.1:3000" })).toThrow();
    expect(() => readIsolation({ ...env, E2E_PASSWORD: "external-account" })).toThrow();
    chmodSync(env.E2E_PRIVATE_ENV, 0o644);
    expect(() => readIsolation(env)).toThrow(/0600/);
  });
  test("拒绝符号链接、过期状态和混入数据库凭据", () => {
    const { env, root } = fixture();
    symlinkSync(env.E2E_PRIVATE_ENV, join(root, "linked.json"));
    expect(() => privateJSON(join(root, "linked.json"))).toThrow();
    const credentials = JSON.parse(readFileSync(env.E2E_PRIVATE_ENV, "utf8"));
    json(env.E2E_PRIVATE_ENV, { ...credentials, DATABASE_URL: "must-not-pass-to-web" });
    expect(() => readIsolation(env)).toThrow(/密钥/);
    json(env.E2E_PRIVATE_ENV, credentials);
    const manifest = JSON.parse(readFileSync(env.E2E_MANIFEST, "utf8"));
    json(env.E2E_MANIFEST, { ...manifest, state: "completed" });
    expect(() => readIsolation(env)).toThrow(/状态/);
  });
  test("实际进程须匹配集群及目录，消费者须属于同一活跃 supervisor", () => {
    const { env, root } = fixture(); const run = readIsolation(env);
    const identity = (pid: number) => ({ parent: pid === 200 ? 150 : 99, uid: process.getuid!(), cwd: pid === 100 ? join(root, "postgres") : root,
      args: pid === 100 ? ["postgres", join(root, "postgres"), "cluster_name=" + runId, "39001"] : ["redis-server 127.0.0.1:39002"] });
    expect(() => assertResourceProcesses(run, identity, 200)).not.toThrow();
    expect(() => assertResourceProcesses(run, (pid: number) => ({ ...identity(pid), cwd: "/online" }), 200)).toThrow();
    expect(() => assertResourceProcesses(run, (pid: number) => ({ ...identity(pid), parent: pid === 200 ? 1 : 99 }), 200)).toThrow(/后代/);
    expect(() => assertResourceProcesses(run, (pid: number) => ({ ...identity(pid), args: ["wrong-instance"] }), 200)).toThrow();
  });
  test("假的完整文件登记也不能放行不存在的真实进程", async () => {
    const { env } = fixture();
    await expect(requireIsolationRunner(env, false)).rejects.toThrow();
  });
  test("实际代理返回旧轮用户或缺少候选标识时在登录前拒绝", async () => {
    const { env } = fixture(); const run = readIsolation(env);
    let matching = false; let requests = 0; let throttled = false;
    const server = createServer((request, response) => {
      requests++; expect(["HEAD", "GET"]).toContain(request.method); expect(request.headers.authorization).toBeUndefined();
      if (throttled && request.method === "GET") { throttled = false; response.writeHead(429); response.end(); return; }
      response.setHeader("content-type", "application/json");
      response.setHeader("x-wenyou-e2e-candidate", "current-candidate");
      response.end(JSON.stringify({ data: { id: matching ? "fake-id" : "old-id", username: "fake-user" } }));
    });
    await new Promise<void>((ok) => server.listen(0, "127.0.0.1", ok));
    try {
      const origin = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
      mockServer.use(http.get(`${origin}/api/v1/users/fake-id`, () => passthrough()));
      mockServer.use(http.head(`${origin}/`, () => passthrough()));
      await expect(verifyRunProfile(run, origin, "current-candidate")).rejects.toThrow();
      matching = true;
      await expect(verifyRunProfile(run, origin, "wrong-candidate")).rejects.toThrow();
      await expect(verifyRunProfile(run, origin, "current-candidate")).resolves.toBeUndefined();
      expect(requests).toBe(5);
      throttled = true;
      await expect(verifyRunProfile(run, origin, "current-candidate")).resolves.toBeUndefined();
      expect(requests).toBe(8);
    } finally { await new Promise<void>((ok) => server.close(() => ok())); }
  });
});
