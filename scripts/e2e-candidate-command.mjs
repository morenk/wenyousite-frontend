import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { cpSync, mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { createServer } from "node:net";
import { fileURLToPath } from "node:url";
import { requireIsolationRunner, readIsolation } from "./e2e-isolation-gate.mjs";
import { assertBrowserArguments, assertCandidateBuild, isolatedOrigin } from "./e2e-candidate-policy.mjs";

const frontend = resolve(fileURLToPath(new URL("..", import.meta.url)));
const children = new Set();
let currentStage = "manifest";
let resultPath;
let stopped = false;
let rejectSignal;
const signal = new Promise((_, reject) => { rejectSignal = reject; });
void signal.catch(() => {});
const abort = () => { stopped = true; rejectSignal(new Error("隔离 Web 测试终止或超时")); };
process.once("SIGTERM", abort); process.once("SIGINT", abort);
const timer = setTimeout(abort, 45 * 60 * 1000);
function start(command, args, env, cwd = frontend) {
  if (stopped) throw new Error("任务已终止");
  // 继承 runner 登记的进程组；SIGKILL 后也由其按登记回收后代。
  const child = spawn(command, args, { cwd, env, stdio: ["ignore", "pipe", "pipe"] });
  children.add(child);
  child.stdout.on("data", () => {});
  child.stderr.on("data", () => {});
  child.on("error", () => {});
  return child;
}
async function exited(child) {
  if (child.exitCode !== null || child.signalCode !== null) return child.exitCode;
  return await new Promise((ok, fail) => { child.once("exit", ok); child.once("error", fail); });
}
async function command(args, env) {
  const child = start("pnpm", args, env);
  let log = "";
  const capture = (data) => { log = (log + data.toString()).slice(-12000); };
  child.stdout.on("data", capture); child.stderr.on("data", capture);
  if (await exited(child) !== 0) {
    writeFileSync(`${resultPath}.build.log`, log, { mode: 0o600 });
    throw new Error("隔离 Web 构建失败，诊断已存入本地私有 build.log");
  }
}
async function freePort() {
  const server = createServer();
  await new Promise((ok, fail) => { server.once("error", fail); server.listen(0, "127.0.0.1", ok); });
  const port = server.address().port;
  await new Promise((ok) => server.close(ok));
  return port;
}
async function run() {
  const [evidencePath, ...args] = process.argv.slice(2);
  if (!evidencePath || !resolve(evidencePath).startsWith(join(frontend, ".e2e-results") + "/")) throw new Error("缺少私有测试报告位置");
  assertBrowserArguments(args);
  resultPath = evidencePath;
  if ([".env", ".env.local", ".env.production", ".env.production.local"].some((name) => existsSync(join(frontend, name)))) {
    throw new Error("隔离候选必须使用不含私有 .env 文件的 Web checkout");
  }
  const run = await requireIsolationRunner(process.env, false);
  const candidateId = randomUUID();
  const buildDir = join(frontend, ".next-e2e");
  // 构建和 Web 服务不获得登录账号、数据库连接串或后端密钥。
  const env = { PATH: process.env.PATH, LANG: "C.UTF-8", TZ: "UTC", NODE_ENV: "production", NEXT_TELEMETRY_DISABLED: "1",
    E2E_RUN_ID: run.manifest.runId, E2E_RESOURCE_ROOT: run.root,
    BACKEND_URL: run.manifest.backendURL, WENYOU_E2E_CANDIDATE_ID: candidateId };
  currentStage = "build";
  await command(["exec", "next", "build"], env);
  const buildId = assertCandidateBuild(buildDir, candidateId, run.manifest.backendURL);
  currentStage = "candidate";
  const preview = join(run.root, "web-candidate");
  mkdirSync(preview, { mode: 0o700 });
  cpSync(join(buildDir, "standalone"), preview, { recursive: true });
  cpSync(join(buildDir, "static"), join(preview, ".next-e2e", "static"), { recursive: true });
  cpSync(join(frontend, "public"), join(preview, "public"), { recursive: true });
  assertCandidateBuild(join(preview, ".next-e2e"), candidateId, run.manifest.backendURL);
  const port = await freePort();
  const origin = isolatedOrigin(`http://127.0.0.1:${port}`);
  const server = start(process.execPath, [join(preview, "server.js")], { ...env, HOSTNAME: "127.0.0.1", PORT: String(port) }, preview);
  let serverLog = "";
  const captureServer = (data) => { serverLog = (serverLog + data.toString()).slice(-12000); };
  server.stdout.on("data", captureServer); server.stderr.on("data", captureServer);
  const testEnv = { ...env, ...run.credentials, E2E_BASE_URL: origin, E2E_BUILD_DIR: join(preview, ".next-e2e"),
    PLAYWRIGHT_NO_COPY_PROMPT: "1",
    E2E_SAFE_REPORT: join(run.root, "web-results.json"),
    RICH_TEXT_REAL_API: "true", RICH_TEXT_RUN_DIR: join(run.root, "rich-text") };
  let ready = false;
  let readinessError = "服务提前退出";
  for (let i = 0; i < 100; i++) {
    if (server.exitCode !== null || server.signalCode !== null || stopped) break;
    try { await requireIsolationRunner(testEnv); ready = true; break; } catch (error) { readinessError = error.message; await new Promise((ok) => setTimeout(ok, 200)); }
  }
  if (!ready) {
    // 此时尚未启动浏览器或登录，Web 环境也不含账号；只保存启动诊断。
    writeFileSync(`${resultPath}.server.log`, serverLog, { mode: 0o600 });
    throw new Error(`候选预检失败：${readinessError}`);
  }
  server.stdout.off("data", captureServer); server.stderr.off("data", captureServer);
  const browserArgs = args.filter((arg) => arg !== "--matrix");
  if (args.includes("--matrix")) testEnv.E2E_BROWSER_MATRIX = "true";
  currentStage = "browser";
  const tests = start("pnpm", ["exec", "playwright", "test", ...browserArgs,
    "--reporter=./scripts/e2e-safe-reporter.ts", `--output=${join(run.root, "browser-results")}`], testEnv);
  const code = await exited(tests);
  const report = existsSync(testEnv.E2E_SAFE_REPORT) ? JSON.parse(readFileSync(testEnv.E2E_SAFE_REPORT, "utf8")) : { status: "failed", tests: [] };
  writeFileSync(evidencePath, JSON.stringify({ runId: run.manifest.runId, candidateId, buildId, ...report }), { mode: 0o600 });
  if (code !== 0 || report.status !== "passed" || !report.tests.length) throw new Error("浏览器验收未通过，已保存脱敏报告");
  readIsolation(testEnv);
}
try {
  await Promise.race([run(), signal]);
} catch (error) {
  if (resultPath && !existsSync(resultPath)) writeFileSync(resultPath, JSON.stringify({ status: "failed", stage: currentStage, error: error.message, tests: [] }), { mode: 0o600 });
  console.error(error.message);
  process.exitCode = 1;
} finally {
  stopped = true;
  clearTimeout(timer);
  for (const child of children) {
    if (child.exitCode === null && child.signalCode === null) {
      child.kill("SIGTERM");
      const hardStop = setTimeout(() => child.kill("SIGKILL"), 5000);
      await exited(child).catch(() => { process.exitCode = 1; });
      clearTimeout(hardStop);
    }
  }
  // runner 负责验证并清理整个资源目录和任何剩余后代；清理失败时外层不得报告通过。
}
