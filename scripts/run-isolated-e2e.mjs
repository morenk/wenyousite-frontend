import { spawn } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { resolve, join } from "node:path";
import { fileURLToPath } from "node:url";
import { fontCoordinationArguments } from "./e2e-font-coordination.mjs";
import { backendRunner } from "./e2e-backend-runner.mjs";
import { assertBrowserArguments, verifiedRunCleanup } from "./e2e-candidate-policy.mjs";

import { runDiagnostics, runEventIdentity, runFailureCategory } from "./e2e-run-diagnostics.mjs";

const frontend = resolve(fileURLToPath(new URL("..", import.meta.url)));
let child;
let interrupted = false;
const stop = () => { if (interrupted) return; interrupted = true; child?.kill("SIGTERM"); };
process.once("SIGTERM", stop); process.once("SIGINT", stop);
const timeout = setTimeout(stop, 50 * 60 * 1000);
try {
  const args = process.argv.slice(2);
  if (process.env.E2E_BROWSER_MATRIX === "true") args.push("--matrix");
  const coordination = fontCoordinationArguments(args);
  const textFontV2 = coordination.browserArgs.length === 0 || args.includes("e2e/dynamic-text-fonts.spec.ts");
  const discussionFixtures = process.env.WENYOUSITE_E2E_DISCUSSION_FIXTURES === "true" || args.includes("e2e/discussion-navigation.spec.ts");
  const roleMentionsV6 = args.length === 0 || args.includes("e2e/role-mentions.spec.ts") || process.env.WENYOUSITE_E2E_ROLE_MENTIONS_V6 === "true";
  const textColorV1 = textFontV2 || args.length === 0 || args.includes("e2e/text-color.spec.ts") || args.includes("e2e/text-font.spec.ts") || process.env.WENYOUSITE_E2E_TEXT_COLOR_V1 === "true";
  const textFontV1 = textFontV2 || args.length === 0 || args.includes("e2e/text-font.spec.ts") || process.env.WENYOUSITE_E2E_TEXT_FONT_V1 === "true";
  const runner = backendRunner(process.env, discussionFixtures, roleMentionsV6, textColorV1, textFontV1, textFontV2);
  const { backend, revision, env } = runner;
  const reports = join(frontend, ".e2e-results");
  mkdirSync(reports, { recursive: true, mode: 0o700 });
  const reportPath = join(reports, `${randomUUID()}.json`);
  assertBrowserArguments(coordination.browserArgs);
  const diagnosticPath = reportPath.replace(/\.json$/, ".private.log");
  const diagnostics = runDiagnostics(diagnosticPath);
  child = spawn(runner.command, [...runner.args, process.execPath, join(frontend, "scripts/e2e-candidate-command.mjs"), reportPath, ...args], {
    cwd: backend, env, stdio: ["ignore", "pipe", "pipe"],
  });
  child.stdout.on("data", (data) => diagnostics.append("stdout", data));
  child.stderr.on("data", (data) => diagnostics.append("stderr", data));
  const code = await new Promise((ok, fail) => { child.once("error", fail); child.once("close", ok); });
  const events = diagnostics.events;
  let identity;
  let identityMismatch = false;
  try { identity = runEventIdentity(events, process.getuid()); }
  catch { identityMismatch = true; }
  const ready = events.find((event) => event.event === "ready");
  const passed = events.find((event) => event.event === "passed" && event.runId === identity?.runId && event.resourcesCleaned === true);
  const cleanupEvent = events.find((event) => event.event === "resources-cleaned" && event.runId === identity?.runId && event.resourcesCleaned === true && event.resourcesVerified === true);
  const report = existsSync(reportPath) ? JSON.parse(readFileSync(reportPath, "utf8")) : { status: "failed", tests: [] };
  let residualCleanup = false;
  if (identity && !passed && existsSync(identity.root)) {
    try {
      // supervisor 已 close；仅通过后端正式入口核验并回收本轮残留，原失败仍保留。
      const current = backendRunner();
      if (current.revision !== revision) throw new Error("后端提交已变化");
      const cleanup = spawn(current.command, [...current.args.slice(0, 2), join(backend, "scripts/e2e-reap.ts"),
        "--root", identity.root, "--run-id", identity.runId, "--apply"], { cwd: backend, env, stdio: "ignore" });
      const cleanupTimer = setTimeout(() => cleanup.kill("SIGTERM"), 120000);
      try { residualCleanup = await new Promise((ok) => { cleanup.once("close", (code) => ok(code === 0)); cleanup.once("error", () => ok(false)); }); }
      finally { clearTimeout(cleanupTimer); }
    } catch { residualCleanup = false; }
  }
  const cleaned = identity && !existsSync(identity.root);
  const cleanupVerified = verifiedRunCleanup(identity?.runId, cleaned, events);
  const success = Boolean(ready) && !identityMismatch && !interrupted && code === 0 && passed && cleaned && report.status === "passed" && report.runId === ready.runId;
  const failureCategory = identityMismatch ? "resource-identity-mismatch" : runFailureCategory({ interrupted, ready: Boolean(ready), tests: report.tests.length, success });
  const phase = ready ? (report.tests.length ? "browser-tests" : "candidate-preparation") : "backend-preparation";
  const resourceState = cleanupVerified ? "created-and-cleaned" : identity ? "created-cleanup-unverified" : "creation-unverified";
  writeFileSync(reportPath, JSON.stringify({ ...report, runId: identity?.runId, resourceRoot: identity?.root, phase, failureCategory, resourceState, privateDiagnosticPath: diagnosticPath, backendSha: revision, residualCleanup, resourcesRemoved: Boolean(cleaned), cleanupVerified, cleanupEventVerified: Boolean(cleaned && cleanupEvent), status: success ? "passed" : "failed" }), { mode: 0o600 });
  console.log(JSON.stringify({ status: success ? "passed" : "failed", runId: identity?.runId, phase, failureCategory, resourceState, tests: report.tests.length,
    failed: report.tests.filter((test) => !["passed", "skipped"].includes(test.status)).map((test) => test.title),
    resourcesCleaned: cleanupVerified, reportPath }));
  if (!success) process.exitCode = 1;
} catch {
  console.error("隔离 E2E 未通过：请核对已提交 runner、只读工具配置与脱敏报告；禁止回退线上地址");
  process.exitCode = 1;
} finally { clearTimeout(timeout); }
