import { inheritedHeavy, runHeavy } from "./dev-heavy.mjs";
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { resolve, join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { backendRunner } from "./e2e-backend-runner.mjs";
import { assertBrowserArguments } from "./e2e-candidate-policy.mjs";

const frontend = resolve(fileURLToPath(new URL("..", import.meta.url)));
if (!inheritedHeavy()) { process.exitCode = await runHeavy(process.execPath, process.argv.slice(1)); } else {
let child;
let interrupted = false;
const stop = () => { if (interrupted) return; interrupted = true; child?.kill("SIGTERM"); };
process.once("SIGTERM", stop); process.once("SIGINT", stop);
const timeout = setTimeout(stop, 50 * 60 * 1000);
try {
  const runner = backendRunner();
  const { backend, revision, env } = runner;
  const reports = join(frontend, ".e2e-results");
  mkdirSync(reports, { recursive: true, mode: 0o700 });
  const reportPath = join(reports, `${randomUUID()}.json`);
  const args = process.argv.slice(2);
  if (process.env.E2E_BROWSER_MATRIX === "true") args.push("--matrix");
  assertBrowserArguments(args);
  child = spawn(runner.command, [...runner.args, process.execPath, join(frontend, "scripts/e2e-candidate-command.mjs"), reportPath, ...args], {
    cwd: backend, env, stdio: ["ignore", "pipe", "pipe"],
  });
  let output = "";
  child.stdout.on("data", (data) => { output += data.toString(); });
  child.stderr.on("data", () => {});
  const code = await new Promise((ok, fail) => { child.once("error", fail); child.once("close", ok); });
  const events = output.split("\n").flatMap((line) => { try { return [JSON.parse(line)]; } catch { return []; } });
  const ready = events.find((event) => event.event === "ready");
  const passed = events.find((event) => event.event === "passed" && event.runId === ready?.runId && event.resourcesCleaned === true);
  const report = existsSync(reportPath) ? JSON.parse(readFileSync(reportPath, "utf8")) : { status: "failed", tests: [] };
  let residualCleanup = false;
  if (ready?.manifestPath && !passed && existsSync(dirname(ready.manifestPath))) {
    try {
      // supervisor 已 close；仅通过后端正式入口核验并回收本轮残留，原失败仍保留。
      const current = backendRunner();
      if (current.revision !== revision) throw new Error("后端提交已变化");
      const cleanup = spawn(current.command, [...current.args.slice(0, 2), join(backend, "scripts/e2e-reap.ts"),
        "--root", dirname(ready.manifestPath), "--run-id", ready.runId, "--apply"], { cwd: backend, env, stdio: "ignore" });
      const cleanupTimer = setTimeout(() => cleanup.kill("SIGTERM"), 120000);
      try { residualCleanup = await new Promise((ok) => { cleanup.once("close", (code) => ok(code === 0)); cleanup.once("error", () => ok(false)); }); }
      finally { clearTimeout(cleanupTimer); }
    } catch { residualCleanup = false; }
  }
  const cleaned = ready?.manifestPath && !existsSync(dirname(ready.manifestPath));
  const success = !interrupted && code === 0 && passed && cleaned && report.status === "passed" && report.runId === ready.runId;
  writeFileSync(reportPath, JSON.stringify({ ...report, backendSha: revision, residualCleanup, resourcesRemoved: Boolean(cleaned), cleanupVerified: Boolean(cleaned && passed), status: success ? "passed" : "failed" }), { mode: 0o600 });
  console.log(JSON.stringify({ status: success ? "passed" : "failed", runId: ready?.runId, tests: report.tests.length,
    failed: report.tests.filter((test) => !["passed", "skipped"].includes(test.status)).map((test) => test.title),
    resourcesCleaned: Boolean(cleaned && passed), reportPath }));
  if (!success) process.exitCode = 1;
} catch {
  console.error("隔离 E2E 未通过：请核对已提交 runner、只读工具配置与脱敏报告；禁止回退线上地址");
  process.exitCode = 1;
} finally { clearTimeout(timeout); }

}
