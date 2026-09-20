/**
 * 后端已提交隔离 runner 接口接入前，所有写入型入口必须关闭。
 * 不保留 E2E_ENV、loopback、外部账号或任意环境变量绕过开关。
 */
export function requireIsolationRunner() {
  throw new Error("写入型 E2E 已关闭：等待接入后端已提交的隔离 runner、资源身份和清理协议；线上仅允许 pnpm test:smoke:readonly");
}

if (process.argv[1]?.endsWith("/e2e-isolation-gate.mjs")) requireIsolationRunner();
