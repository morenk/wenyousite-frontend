import { appendFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

/** 私有输出有界保存；只解析固定事件，不把原始错误或环境放入安全报告。 */
export function runDiagnostics(path, limit = 1048576) {
  writeFileSync(path, "", { flag: "wx", mode: 0o600 });
  const events = [];
  const pending = { stdout: "", stderr: "" };
  let written = 0;
  return {
    events,
    append(stream, bytes) {
      const chunk = Buffer.from(bytes);
      if (written < limit) {
        const part = chunk.subarray(0, limit - written);
        appendFileSync(path, part);
        written += part.length;
      }
      pending[stream] += chunk.toString();
      const lines = pending[stream].split("\n");
      pending[stream] = lines.pop().slice(-65536);
      for (const line of lines) {
        if (line.length > 65536 || events.length >= 512) continue;
        try {
          const event = JSON.parse(line);
          if (["resources-verified", "resources-cleaned", "ready", "passed", "startup-failed", "font-worker-startup-failed", "shutdown-failed", "suite-failed"].includes(event?.event)) events.push(event);
        } catch { /* 原始输出仅进入私有文件。 */ }
      }
    },
  };
}

/** 只接受同一 supervisor 输出中一致的本轮身份；不能从任意路径推断清理权限。 */
export function runEventIdentity(events, uid) {
  const resources = events.filter(e => ["resources-verified", "resources-cleaned"].includes(e.event));
  const ready = events.find(e => e.event === "ready");
  const first = resources[0];
  if (!first) return undefined;
  const valid = e => /^e2e_[a-f0-9]{24}$/.test(e.runId) && e.uid === uid && /^\/tmp\/wenyousite-e2e-[a-zA-Z0-9]{6}$/.test(e.root);
  if (!valid(first) || resources.some(e => !valid(e) || e.runId !== first.runId || e.root !== first.root)
    || (ready && (ready.runId !== first.runId || typeof ready.manifestPath !== "string" || dirname(ready.manifestPath) !== first.root))) {
    throw new Error("e2e-resource-identity-mismatch");
  }
  return { runId: first.runId, root: first.root, ready: Boolean(ready) };
}

export function runFailureCategory({ interrupted, ready, tests, success }) {
  if (success) return undefined;
  if (interrupted) return "interrupted";
  if (!ready) return "backend-startup-failed";
  return tests ? "browser-tests-failed" : "candidate-preparation-failed";
}
