import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { backendRunner } from "./e2e-backend-runner.mjs";
import { requireIsolationRunner } from "./e2e-isolation-gate.mjs";

const file = fileURLToPath(import.meta.url);
const frontend = resolve(dirname(file), "..");
const reports = join(frontend, ".e2e-results");
const json = (path) => JSON.parse(readFileSync(path, "utf8"));
const save = (path, data) => writeFileSync(path, JSON.stringify(data), { mode: 0o600 });
const alive = (pid) => {
  try { return readFileSync(`/proc/${pid}/stat`, "utf8").split(") ").at(-1).split(" ")[0] !== "Z"; } catch { return false; }
};

if (process.argv[2] === "--consumer") {
  const [mode, result] = process.argv.slice(3);
  if (!["failure", "sigterm", "sigint", "timeout", "sigkill", "success"].includes(mode) || dirname(result) !== reports) throw new Error("非法生命周期探针参数");
  const run = await requireIsolationRunner(process.env, false);
  const { chromium } = await import("@playwright/test");
  // 让信号真正终止探针，避免 Playwright 自身将 SIGTERM 转为正常退出而漏测 runner 清理。
  const browser = await chromium.launchServer({ headless: true, handleSIGTERM: false, handleSIGINT: false });
  const browserPid = browser.process().pid;
  const processes = json(join(run.root, "processes.json"));
  save(result, { runId: run.manifest.runId, root: run.root, mode, browserPid,
    pids: processes.processes.map((p) => p.group).concat(browserPid),
    ports: [run.manifest.postgres.port, run.manifest.redis.port, Number(new URL(run.manifest.backendURL).port)] });
  if (mode === "sigkill") process.kill(process.pid, "SIGKILL");
  else if (mode === "sigterm") setTimeout(() => process.kill(process.pid, "SIGTERM"), 100);
  else if (mode === "sigint") setTimeout(() => process.kill(process.pid, "SIGINT"), 100);
  else if (mode === "timeout") await new Promise(() => {});
  else { await browser.close(); process.exitCode = mode === "failure" ? 1 : 0; }
} else {
  const runner = backendRunner();
  const { backend, revision, env } = runner;
  mkdirSync(reports, { recursive: true, mode: 0o700 });
  const results = [];
  for (const mode of ["failure", "sigterm", "sigint", "timeout", "sigkill", "success"]) {
    const report = join(reports, `lifecycle-${randomUUID()}.json`);
    const child = spawn(runner.command, [...runner.args, process.execPath, file, "--consumer", mode, report], { cwd: backend, env, stdio: ["ignore", "pipe", "pipe"] });
    let output = "";
    child.stdout.on("data", (data) => { output += data.toString(); }); child.stderr.on("data", () => {});
    const timer = setTimeout(() => child.kill("SIGTERM"), 120000);
    let timeoutTriggered = false;
    const timeoutProbe = mode === "timeout" ? setInterval(() => {
      if (existsSync(report) && !timeoutTriggered) { timeoutTriggered = true; child.kill("SIGTERM"); }
    }, 100) : undefined;
    const code = await new Promise((ok, fail) => { child.once("close", ok); child.once("error", fail); });
    clearTimeout(timer);
    clearInterval(timeoutProbe);
    if (!existsSync(report)) throw new Error("生命周期探针未启动；禁止回退在线环境");
    const data = json(report);
    // 强杀允许保留已登记目录，随后 success 启动必须完成登记回收。
    const directoryRemoved = !existsSync(data.root);
    const remainingPids = data.pids.filter(alive);
    const immediateCleanup = directoryRemoved && remainingPids.length === 0;
    const successful = mode === "success";
    const passed = output.split("\n").some((line) => { try { const e = JSON.parse(line); return e.event === "passed" && e.runId === data.runId && e.resourcesCleaned; } catch { return false; } });
    const exitExpected = (successful ? code === 0 && passed : code !== 0) && (mode !== "timeout" || timeoutTriggered);
    results.push({ ...data, immediateCleanup, directoryRemoved, remainingPids, exitExpected, report });
  }
  const { createConnection } = await import("node:net");
  const closed = async (port) => await new Promise((ok) => {
    const socket = createConnection({ host: "127.0.0.1", port });
    socket.setTimeout(1000); socket.once("connect", () => { socket.destroy(); ok(false); });
    socket.once("error", () => ok(true)); socket.once("timeout", () => { socket.destroy(); ok(false); });
  });
  for (const result of results) {
    result.resourcesRemoved = !existsSync(result.root) && result.pids.every((pid) => !alive(pid)) && (await Promise.all(result.ports.map(closed))).every(Boolean);
    result.passed = result.exitExpected && result.resourcesRemoved && (result.mode === "sigkill" || result.immediateCleanup);
    save(result.report, { ...result, backendSha: revision });
    console.log(JSON.stringify({ mode: result.mode, runId: result.runId, passed: result.passed, immediateCleanup: result.immediateCleanup, resourcesRemoved: result.resourcesRemoved, report: result.report }));
  }
  if (results.some((result) => !result.passed)) process.exitCode = 1;
}
