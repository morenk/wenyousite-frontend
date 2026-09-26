import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import { isAbsolute, join } from "node:path";

/** 固定已提交 v1 接口；直接启动 supervisor，让终止信号不丢在包管理器中间层。 */
export function backendRunner(env = process.env) {
  const backend = env.WENYOUSITE_E2E_BACKEND_ROOT;
  const revision = env.WENYOUSITE_E2E_BACKEND_REF;
  if (!backend || !isAbsolute(backend) || !/^[a-f0-9]{40}$/.test(revision ?? "")) throw new Error("必须指定已提交 runner 的后端绝对路径与完整 SHA");
  const git = (...args) => execFileSync("git", ["-C", backend, ...args], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
  if (git("rev-parse", "HEAD") !== revision || git("status", "--porcelain")) throw new Error("后端 runner 必须位于干净且匹配指定提交的 checkout");
  // 合并可采用 squash；身份绑定精确 checkout 和实际 v1 manifest，不依赖保留任务祖先提交。
  git("ls-files", "--error-unmatch", "scripts/e2e-runner.ts", "docs/e2e-isolation.md");
  if (!existsSync(join(backend, "dist/main.js"))) throw new Error("后端必须先完成自身 pnpm check 和构建");
  const childEnv = { PATH: env.PATH, LANG: "C.UTF-8", TZ: "UTC" };
  for (const key of ["E2E_PG_BIN", "E2E_REDIS_BIN", "E2E_LIBRARY_PATH"]) if (env[key]) childEnv[key] = env[key];
  const loader = createRequire(join(backend, "package.json")).resolve("tsx");
  return { backend, revision, env: childEnv, command: process.execPath,
    args: ["--import", loader, join(backend, "scripts/e2e-runner.ts"), "--admin-fixtures", "--mobile-release-fixtures", "--"] };
}
