import { spawn, execFileSync } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { existsSync, readFileSync, readdirSync, writeFileSync, renameSync, mkdirSync, realpathSync, readlinkSync, lstatSync, openSync, closeSync } from "node:fs";
import { createServer } from "node:net";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { validateDescriptor, verifyRuntime } from "./dev-preview-policy.mjs";
import { previewProxy } from "./dev-preview-proxy.mjs";
import { listSessions, globalLock, assertAvailable, assertOperationLocks } from "./dev-preview-registry.mjs";

const file = fileURLToPath(import.meta.url);
let worktree = realpathSync(resolve(dirname(file), ".."));
let directory = join(worktree, ".dev-preview");
let stateFile = join(directory, "session.json");
const load = () => JSON.parse(readFileSync(stateFile, "utf8"));
const save = (value) => { const temp = `${stateFile}.${process.pid}.tmp`; writeFileSync(temp, JSON.stringify(value, null, 2), { mode: 0o600 }); renameSync(temp, stateFile); };
const sleep = (ms) => new Promise((ok) => setTimeout(ok, ms));

function identity(pid) {
  try {
    const fields = readFileSync(`/proc/${pid}/stat`, "utf8").split(") ").at(-1).split(" ");
    if (fields[0] === "Z") return null;
    return { pid, ticks: fields[19], group: Number(fields[2]), session: Number(fields[3]), cwd: realpathSync(`/proc/${pid}/cwd`) };
  } catch { return null; }
}
function owned(processInfo) {
  const current = processInfo && identity(processInfo.pid);
  return !!current && current.ticks === processInfo.ticks && current.group === processInfo.group && current.session === processInfo.session && current.cwd === worktree;
}
function source() {
  const options = { cwd: worktree, encoding: "utf8" };
  const commit = execFileSync("git", ["rev-parse", "HEAD"], options).trim();
  const files = execFileSync("git", ["ls-files", "-z", "--cached", "--others", "--exclude-standard"], options).split("\0").filter(Boolean).sort();
  const hash = createHash("sha256");
  for (const path of files) {
    const absolute = join(worktree, path);
    hash.update(path).update("\0");
    if (!existsSync(absolute)) { hash.update("deleted\0"); continue; }
    hash.update(lstatSync(absolute).isSymbolicLink() ? readlinkSync(absolute) : readFileSync(absolute)); hash.update("\0");
  }
  return { sourceCommit: commit, sourceDigest: hash.digest("hex") };
}
async function webIdentity(descriptor, webSessionId) {
  const response = await fetch(`${descriptor.web.origin}/__preview/identity`, { redirect: "error", signal: AbortSignal.timeout(5000), cache: "no-store" });
  const actual = await response.json();
  if (response.status !== 200 || response.headers.get("x-wenyou-preview-web") !== webSessionId || response.headers.get("x-wenyou-preview-run") !== descriptor.runId
    || actual.role !== "web" || actual.runId !== descriptor.runId || actual.sessionId !== descriptor.sessionId
    || actual.snapshotSha256 !== descriptor.snapshot.sha256 || actual.backendOrigin !== descriptor.backend.origin
    || actual.mediaOrigin !== descriptor.media.origin || actual.webOrigin !== descriptor.web.origin) throw new Error("Web 实际代理身份不匹配");
}
async function freePort(port) {
  const server = createServer();
  await new Promise((ok, fail) => { server.once("error", fail); server.listen(port, "127.0.0.1", ok); });
  await new Promise((ok) => server.close(ok));
}
function groupMembers(info) {
  if (!info) return [];
  return readdirSync("/proc").filter((name) => /^\d+$/.test(name)).map((name) => identity(Number(name)))
    .filter((item) => item && item.cwd === worktree && item.group === info.pid && item.session === info.pid && BigInt(item.ticks) >= BigInt(info.ticks));
}
async function stopChild(info, members = []) {
  const registered = [info, ...members].filter((item) => item && item.group === info?.pid && item.session === info?.pid);
  const active = () => registered.some(owned);
  // CLI 本身被强杀后，仍用事先登记的活 server 身份证明进程组归属。
  if (!active()) return;
  process.kill(-info.pid, "SIGTERM");
  for (let i = 0; i < 60 && active(); i++) await sleep(100);
  if (active()) process.kill(-info.pid, "SIGKILL");
  for (let i = 0; i < 30 && active(); i++) await sleep(100);
  if (active()) throw new Error("预览进程组退出未确认，保留登记");
}
function result(state, status) {
  const d = state.consumer;
  return { version: 1, kind: "wenyou-web-preview", status, task: state.task, worktree, sessionId: d.sessionId, runId: d.runId,
    descriptor: state.descriptor, browserUrl: status === "ready" ? d.web.origin : null,
    ports: { backend: d.backend.port, media: d.media.port, web: d.web.port }, snapshot: d.snapshot, webSessionId: state.webSessionId,
    ...source(), startedSource: state.startedSource, log: join(directory, "server.log"), protocolSha: state.protocolSha };
}
async function daemon(token) {
  let state = load();
  if (state.token !== token || state.worktree !== worktree || state.status !== "starting" || state.supervisor
    || process.ppid !== state.launcher?.pid || !owned(state.launcher)) throw new Error("预览启动登记不匹配");
  assertOperationLocks(worktree, false);
  const descriptor = validateDescriptor(state.consumer);
  let proxy; let stopping = false; let watcher;
  const shutdown = async (failure) => {
    if (stopping) return; stopping = true; clearInterval(watcher);
    await stopChild(state.next, state.members); await proxy?.close();
    save({ ...state, status: failure ? "failed" : "stopped", stoppedAt: new Date().toISOString() });
    process.exit(failure ? 1 : 0);
  };
  process.on("SIGTERM", () => { void shutdown(false); });
  process.on("SIGINT", () => { void shutdown(false); });
  try {
    state = { ...state, supervisor: identity(process.pid) }; save(state);
    proxy = await previewProxy(descriptor, state.webSessionId);
    const env = { ...process.env, NODE_ENV: "development", BACKEND_URL: proxy.origin,
      WENYOU_PREVIEW_RUN: descriptor.runId, WENYOU_PREVIEW_SESSION: descriptor.sessionId, WENYOU_PREVIEW_TASK: state.task, WENYOU_PREVIEW_WEB_SESSION: state.webSessionId,
      WENYOU_PREVIEW_SNAPSHOT: descriptor.snapshot.capturedAt, WENYOU_PREVIEW_MEDIA_ORIGIN: descriptor.media.origin,
      NEXT_TELEMETRY_DISABLED: "1", DISABLE_NEXT_DEV_INDICATORS: "true" };
    delete env.WENYOU_E2E_CANDIDATE_ID;
    const child = spawn(process.execPath, [join(worktree, "node_modules/next/dist/bin/next"), "dev", "--hostname", "127.0.0.1", "--port", String(descriptor.web.port)], { cwd: worktree, env, detached: true, stdio: "inherit" });
    child.once("error", () => { void shutdown(true); });
    child.once("exit", () => { if (!stopping) void shutdown(true); });
    state = { ...state, next: identity(child.pid), status: "starting", members: [] }; save(state);
    const registerMembers = () => {
      const members = groupMembers(state.next);
      if (JSON.stringify(members) !== JSON.stringify(state.members)) { state = { ...state, members }; save(state); }
    };
    watcher = setInterval(registerMembers, 500);
    registerMembers();
    for (let i = 0; i < 120 && !stopping; i++) {
      try { await webIdentity(descriptor, state.webSessionId); registerMembers(); state = { ...state, status: "ready", readyAt: new Date().toISOString() }; save(state); return; }
      catch { await sleep(500); }
    }
    if (!stopping) throw new Error("预览启动超时");
  } catch (error) { console.error(error.message); await shutdown(true); }
}
async function main() {
  if (process.platform !== "linux") throw new Error("Web 预览只在 VPS 的 Linux Worktree 启动");
  process.chdir(worktree);
  const invocation = process.argv.slice(2);
  const locked = invocation[0] === "--lock-held";
  if (locked) invocation.shift();
  let [command = "start", ...args] = invocation;
  if (command === "pause") command = "stop";
  if (command === "--daemon") { await daemon(args[0]); return; }
  const options = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--json") continue;
    if (!["--descriptor", "--task", "--confirm", "--worktree"].includes(args[i]) || !args[i + 1] || args[i + 1].startsWith("--")) throw new Error("用法：dev:preview start|status|stop --task ID [--descriptor /absolute/consumer.json] [--json]");
    options[args[i].slice(2)] = args[++i];
  }
  if (command === "list") { console.log(JSON.stringify({ version: 1, kind: "wenyou-web-preview-list", sessions: listSessions(worktree) })); return; }
  if (!["start", "status", "stop"].includes(command) || !/^[A-Za-z0-9_:/.-]{1,160}$/.test(options.task ?? "")) throw new Error("必须指定 start|status|stop 与 --task ID");
  if (options.worktree) {
    if (!["stop", "status"].includes(command) || !options.worktree.startsWith("/") || !options.confirm) throw new Error("跨 Worktree 仅支持带 --confirm 的 status/stop/pause");
    const target = realpathSync(options.worktree);
    const known = execFileSync("git", ["worktree", "list", "--porcelain"], { cwd: worktree, encoding: "utf8" }).split("\n").includes(`worktree ${target}`);
    if (!known) throw new Error("目标不是本仓库已登记 Worktree");
    worktree = target; directory = join(worktree, ".dev-preview"); stateFile = join(directory, "session.json");
    process.chdir(worktree);
  }
  mkdirSync(directory, { recursive: true, mode: 0o700 });
  const lock = globalLock();
  if (!locked) {
    // flock 的锁由内核随进程释放；崩溃后不留下需要人工删除的占用锁。
    const child = spawn("flock", ["--nonblock", "--close", "--conflict-exit-code", "75", lock, "flock", "--nonblock", "--close", "--conflict-exit-code", "75", join(directory, "operation.lock"), process.execPath, file, "--lock-held", ...invocation], { cwd: worktree, stdio: "inherit" });
    const code = await new Promise((ok, fail) => { child.once("exit", ok); child.once("error", fail); });
    if (code === 75) throw new Error("预览生命周期操作正在进行，请稍后重试");
    process.exitCode = code ?? 1; return;
  }
  assertOperationLocks(worktree);
  {
    let previous = existsSync(stateFile) ? load() : null;
    if (previous && (previous.worktree !== worktree || previous.task !== options.task)) throw new Error("Worktree 已登记其他任务，禁止接管");
    if (options.confirm && previous?.consumer?.runId !== options.confirm) throw new Error("预览 runId 已变化，拒绝停止或接管");
    if (command === "stop") {
      const owner = listSessions(worktree).find((item) => item.worktree === worktree);
      if (owner?.blocked) throw new Error("预览进程归属冲突，保留现场");
      if (!previous) { console.log(JSON.stringify({ status: "stopped", task: options.task, worktree })); return; }
      if (owned(previous.supervisor)) {
        process.kill(previous.supervisor.pid, "SIGTERM");
        for (let i = 0; i < 100 && owned(previous.supervisor); i++) await sleep(100);
        if (owned(previous.supervisor)) throw new Error("预览 supervisor 未停止，保留现场");
      }
      await stopChild(previous.next, previous.members);
      previous = { ...load(), status: "stopped" }; save(previous);
      console.log(JSON.stringify(result(previous, "stopped"))); return;
    }
    if (command === "status") {
      if (!previous) { console.log(JSON.stringify({ status: "absent", task: options.task, worktree })); return; }
      let status = owned(previous.supervisor) || owned(previous.next) || previous.members?.some(owned) ? "unavailable" : "stopped";
      if (status === "unavailable") { try { await webIdentity(previous.consumer, previous.webSessionId); status = "ready"; } catch { /* 不向不可用代理交付地址。 */ } }
      console.log(JSON.stringify(result(previous, status))); return;
    }
    if (!options.descriptor?.startsWith("/")) throw new Error("必须显式指定绝对路径 --descriptor；禁止回退线上后端");
    const descriptorPath = realpathSync(options.descriptor);
    const consumer = validateDescriptor(JSON.parse(readFileSync(descriptorPath, "utf8")));
    for (const [role, port] of [["web", 14310], ["backend", 14311], ["media", 14312]]) {
      if (consumer[role].port !== port) throw new Error("预览必须使用标准端口组 14310/14311/14312；历史批次先暂停并显式 rebind");
    }
    assertAvailable(listSessions(worktree), worktree);
    await Promise.all([verifyRuntime(consumer, "backend"), verifyRuntime(consumer, "media")]);
    if (previous && (owned(previous.supervisor) || owned(previous.next) || previous.members?.some(owned))) {
      if (previous.consumer.runId !== consumer.runId || JSON.stringify(previous.consumer) !== JSON.stringify(consumer)) throw new Error("运行中的预览属于另一实例，请先显式停止");
      await webIdentity(consumer, previous.webSessionId); console.log(JSON.stringify(result(previous, "ready"))); return;
    }
    await freePort(consumer.web.port);
    const { PREVIEW_PROTOCOL_SHA } = await import("./dev-preview-policy.mjs");
    const state = { worktree, task: options.task, descriptor: descriptorPath, consumer, protocolSha: PREVIEW_PROTOCOL_SHA,
      launcher: identity(process.pid), token: randomUUID(), webSessionId: randomUUID(), status: "starting", startedSource: source(), startedAt: new Date().toISOString() };
    save(state);
    const log = openSync(join(directory, "server.log"), "a", 0o600);
    const child = spawn(process.execPath, [file, "--daemon", state.token], { cwd: worktree, detached: true, stdio: ["ignore", log, log] });
    closeSync(log); child.unref();
    for (let i = 0; i < 180; i++) {
      await sleep(500);
      const current = load();
      if (current.status === "ready") { await webIdentity(consumer, current.webSessionId); console.log(JSON.stringify(result(current, "ready"))); return; }
      if (["failed", "stopped"].includes(current.status) || child.exitCode !== null) throw new Error("预览启动失败，查看 .dev-preview/server.log");
    }
    throw new Error("预览启动超时，保留登记；请用 status/stop 核验");
  }
}
main().catch((error) => { console.error(JSON.stringify({ error: error.message })); process.exitCode = 1; });
