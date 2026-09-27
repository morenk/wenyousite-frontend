import { execFileSync } from "node:child_process";
import { readFileSync, existsSync, realpathSync, mkdirSync, lstatSync, readdirSync } from "node:fs";
import { join } from "node:path";

export function processIdentity(pid) {
  try {
    const fields = readFileSync(`/proc/${pid}/stat`, "utf8").split(") ").at(-1).split(" ");
    if (fields[0] === "Z") return null;
    let cwd;
    try { cwd = realpathSync(`/proc/${pid}/cwd`); } catch { cwd = null; }
    return { pid, ticks: fields[19], group: Number(fields[2]), session: Number(fields[3]), cwd };
  } catch { return existsSync(`/proc/${pid}`) ? { pid } : null; }
}

export function inspectSession(state, worktree, identify = processIdentity) {
  let processAlive = false;
  let blocked = !state || state.worktree !== worktree
    || !/^[A-Za-z0-9_:/.-]{1,160}$/.test(state.task ?? "")
    || !/^preview_[a-f0-9]{24}$/.test(state.consumer?.runId ?? "")
    || !/^[a-z][a-z0-9-]{2,47}$/.test(state.consumer?.sessionId ?? "")
    || !["starting", "ready", "failed", "stopped"].includes(state.status)
    || !Array.isArray(state.members ?? []);
  for (const item of [state?.supervisor, state?.next, ...(Array.isArray(state?.members) ? state.members : [])].filter(Boolean)) {
    if (!Number.isInteger(item.pid) || item.pid < 1 || !/^\d+$/.test(item.ticks ?? "") || !Number.isInteger(item.group) || !Number.isInteger(item.session)) { blocked = true; continue; }
    const actual = identify(item.pid);
    if (!actual) continue;
    const owned = actual.ticks === item.ticks && actual.group === item.group && actual.session === item.session && actual.cwd === worktree;
    if (owned) processAlive = true;
    else blocked = true;
  }
  return { task: state?.task ?? null, worktree, sessionId: state?.consumer?.sessionId ?? null,
    runId: state?.consumer?.runId ?? null, state: blocked ? "ownership-conflict" : processAlive ? state.status : "stopped",
    processAlive, blocked, ports: Object.fromEntries(["backend", "media", "web"].map((key) => [key, state?.consumer?.[key]?.port ?? null])) };
}

export function listSessions(worktree) {
  const paths = execFileSync("git", ["worktree", "list", "--porcelain"], { cwd: worktree, encoding: "utf8" })
    .split("\n").filter((line) => line.startsWith("worktree ")).map((line) => line.slice(9));
  return paths.flatMap((path) => {
    const file = join(path, ".dev-preview", "session.json");
    if (!existsSync(file)) return [];
    try { return [inspectSession(JSON.parse(readFileSync(file, "utf8")), realpathSync(path))]; }
    catch { return [inspectSession(null, path)]; }
  });
}

export function globalLock() {
  const directory = `/tmp/wenyou-web-preview-${process.getuid()}`;
  mkdirSync(directory, { recursive: true, mode: 0o700 });
  const info = lstatSync(directory);
  if (!info.isDirectory() || info.isSymbolicLink() || info.uid !== process.getuid() || (info.mode & 0o077)) throw new Error("Web 全局登记目录归属或权限无效");
  return join(directory, "operation.lock");
}

export function assertAvailable(sessions, worktree) {
  const conflict = sessions.find((item) => item.blocked || (item.worktree !== worktree && item.processAlive));
  if (conflict) throw new Error(`已有 Web 预览或归属冲突，先暂停已核验的所有者：${JSON.stringify(conflict)}`);
}


/** 内部标记不是锁凭据：沿真实祖先检查 flock 的规范锁文件与内核 fdinfo。 */
export function assertOperationLocks(worktree, requireFlockParent = true) {
  if (requireFlockParent) {
    let valid = false;
    try { valid = realpathSync(`/proc/${process.ppid}/exe`) === realpathSync("/usr/bin/flock"); } catch { /* 无法核验父进程时拒绝。 */ }
    if (!valid) throw new Error("内部预览入口必须由 flock 调用");
  }
  const required = new Set([globalLock(), join(worktree, ".dev-preview", "operation.lock")]);
  let pid = process.ppid;
  const seen = new Set();
  while (pid > 1 && !seen.has(pid)) {
    seen.add(pid);
    try {
      if (realpathSync(`/proc/${pid}/exe`) === realpathSync("/usr/bin/flock")) {
        for (const fd of readdirSync(`/proc/${pid}/fd`)) {
          try {
            const path = realpathSync(`/proc/${pid}/fd/${fd}`);
            if (required.has(path) && /FLOCK\s+ADVISORY\s+WRITE/.test(readFileSync(`/proc/${pid}/fdinfo/${fd}`, "utf8"))) required.delete(path);
          } catch { /* 祖先的非锁文件可能已关闭。 */ }
        }
      }
      pid = Number(readFileSync(`/proc/${pid}/stat`, "utf8").split(") ").at(-1).split(" ")[1]);
    } catch { break; }
  }
  if (required.size) throw new Error("内部预览入口未实际持有全局与 Worktree 锁");
}
