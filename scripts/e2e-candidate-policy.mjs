import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/** 只允许筛选用例，不能替换配置、输出器或安全断言。 */
export function assertBrowserArguments(args) {
  const filters = new Set(["--grep", "-g", "--grep-invert", "--project", "--max-failures"]);
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--matrix" || !arg.startsWith("-")) continue;
    const key = arg.split("=")[0];
    if (!filters.has(key)) throw new Error("浏览器入口仅允许用例筛选参数，禁止覆盖隔离配置和报告");
    if (!arg.includes("=") && (!args[++i] || args[i].startsWith("-"))) throw new Error("用例筛选缺少参数");
  }
}

export function isolatedOrigin(value) {
  let url;
  try { url = new URL(value); } catch { throw new Error("隔离目标缺失或无效"); }
  if (url.protocol !== "http:" || url.hostname !== "127.0.0.1"
    || url.username || url.password || url.pathname !== "/" || url.search || url.hash
    || !url.port || ["3000", "3001"].includes(url.port)) {
    throw new Error("隔离目标必须使用独立的 127.0.0.1 HTTP 端口，禁止线上端口及公网");
  }
  return url.origin;
}

export function candidateOptions(env) {
  const candidateId = env.WENYOU_E2E_CANDIDATE_ID;
  if (!candidateId) return {};
  if (!/^[a-f0-9-]{36}$/.test(candidateId)) throw new Error("E2E 候选构建身份无效");
  isolatedOrigin(env.BACKEND_URL);
  return { distDir: ".next-e2e", generateBuildId: async () => `e2e-${candidateId}` };
}

export function candidateHeaders(env) {
  const options = candidateOptions(env);
  return options.distDir ? [{ key: "X-Wenyou-E2E-Candidate", value: env.WENYOU_E2E_CANDIDATE_ID }] : [];
}

export function assertCandidateResponse(response, candidateId) {
  if (!response.ok || response.redirected || response.headers.get("x-wenyou-e2e-candidate") !== candidateId) {
    throw new Error("实际候选 HTTP 服务身份不匹配");
  }
}

/** 校验的是实际已生成 rewrites，不能用启动时 BACKEND_URL 替代。 */
export function assertCandidateBuild(directory, candidateId, backendOrigin) {
  const expected = isolatedOrigin(backendOrigin);
  const buildId = readFileSync(resolve(directory, "BUILD_ID"), "utf8").trim();
  const manifest = JSON.parse(readFileSync(resolve(directory, "routes-manifest.json"), "utf8"));
  const rewrites = Array.isArray(manifest.rewrites) ? manifest.rewrites
    : Object.values(manifest.rewrites ?? {}).flat();
  const apiRoutes = rewrites.filter((route) => route.source === "/api/v1/:path*");
  if (buildId !== `e2e-${candidateId}` || rewrites.length !== 1 || apiRoutes.length !== 1
    || apiRoutes[0].destination !== `${expected}/api/v1/:path*`) {
    throw new Error("候选构建身份或实际 API rewrites 不匹配");
  }
  return buildId;
}

export function assertDeployableBuild(directory) {
  const id = readFileSync(resolve(directory, "BUILD_ID"), "utf8").trim();
  const { config } = JSON.parse(readFileSync(resolve(directory, "required-server-files.json"), "utf8"));
  if (id.startsWith("e2e-") || config.distDir !== ".next") {
    throw new Error("拒绝将 E2E 隔离候选构建组装为部署 release");
  }
}
