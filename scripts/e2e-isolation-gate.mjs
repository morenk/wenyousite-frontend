import { lstatSync, readFileSync, realpathSync } from "node:fs";
import { dirname, isAbsolute, join } from "node:path";
import { isolatedOrigin, assertCandidateBuild, assertCandidateResponse } from "./e2e-candidate-policy.mjs";

const ensure = (condition, message) => { if (!condition) throw new Error(message); };
export function privateJSON(path) {
  try {
    ensure(isAbsolute(path) && realpathSync(path) === path, "path");
    const stat = lstatSync(path);
    ensure(stat.isFile() && stat.uid === process.getuid() && (stat.mode & 0o777) === 0o600, "mode");
    return JSON.parse(readFileSync(path, "utf8"));
  } catch { throw new Error("隔离登记必须为当前身份的 0600 普通文件，禁止链接或无效 JSON"); }
}

/** @param {Record<string, string | undefined>} env */
export function readIsolation(env = process.env) {
  ensure(env.E2E_MANIFEST && env.E2E_RUN_ID && env.E2E_PRIVATE_ENV, "缺少隔离 runner 身份；禁止直接执行写入型 E2E");
  const m = privateJSON(env.E2E_MANIFEST);
  const root = dirname(env.E2E_MANIFEST);
  const stat = lstatSync(root);
  ensure(stat.isDirectory() && stat.uid === process.getuid() && (stat.mode & 0o777) === 0o700 && realpathSync(root) === root, "隔离目录身份或权限错误");
  ensure(m.version === 1 && m.state === "ready" && /^e2e_[a-f0-9]{24}$/.test(m.runId) && m.runId === env.E2E_RUN_ID, "隔离 manifest 身份或状态错误");
  ensure(m.privateEnvPath === join(root, "private.env.json") && m.privateEnvPath === env.E2E_PRIVATE_ENV
    && m.resourcesPath === join(root, "resources.json") && m.uploadPath === join(root, "uploads"), "隔离路径必须属于本轮登记目录");
  const backend = isolatedOrigin(m.backendURL);
  ensure(backend === env.E2E_BACKEND_URL && m.apiBase === `${backend}/api/v1` && m.apiBase === env.API_BASE, "实际后端地址未绑定本轮 manifest");
  const own = privateJSON(join(root, "ownership.json"));
  const resources = privateJSON(m.resourcesPath);
  ensure(own.runId === m.runId && own.root === root && own.uid === process.getuid()
    && resources.runId === m.runId && resources.root === root && resources.uid === own.uid, "资源所有权不匹配");
  ensure(m.postgres?.host === "127.0.0.1" && m.postgres.clusterName === m.runId
    && m.postgres.database === `wenyousite_${m.runId}` && resources.pgPort === m.postgres.port && m.postgres.port !== 5432
    && m.redis?.host === "127.0.0.1" && resources.redisPort === m.redis.port && m.redis.port !== 6379
    && resources.redisInstance === m.redis.instanceId && /^[a-f0-9]{40}$/.test(m.redis.instanceId), "数据库或缓存资源登记不匹配");
  ensure([m.postgres.port, m.redis.port].every((port) => Number.isInteger(port) && port > 1024 && port <= 65535)
    && new Set([m.postgres.port, m.redis.port, Number(new URL(backend).port)]).size === 3, "隔离资源端口无效或重复");
  ensure(lstatSync(m.uploadPath).isDirectory() && realpathSync(m.uploadPath) === m.uploadPath, "上传目录身份漂移");
  const credentials = privateJSON(m.privateEnvPath);
  const allowed = new Set(["E2E_RUN_ID", "E2E_MANIFEST", "E2E_PRIVATE_ENV", "E2E_BACKEND_URL", "API_BASE", "E2E_USER_ID", "E2E_USERNAME", "E2E_EMAIL", "E2E_PASSWORD"]);
  ensure(Object.keys(credentials).every((key) => allowed.has(key)), "Web 私有环境不能包含数据库或后端密钥");
  for (const key of ["E2E_RUN_ID", "E2E_MANIFEST", "E2E_PRIVATE_ENV", "E2E_BACKEND_URL", "API_BASE"]) {
    ensure(credentials[key] === env[key], "私有账号文件与运行身份不一致");
  }
  for (const key of ["E2E_USER_ID", "E2E_USERNAME", "E2E_EMAIL", "E2E_PASSWORD"]) {
    ensure(typeof credentials[key] === "string" && credentials[key].length > 0 && (!env[key] || credentials[key] === env[key]), "缺少本轮随机账号或混入外部账号");
  }
  ensure(credentials.E2E_EMAIL.endsWith("@e2e.invalid"), "禁止使用真实账号进行 E2E");
  return { manifest: m, root, resources, credentials };
}

export function processIdentity(pid) {
  try {
    ensure(Number.isInteger(pid) && pid > 1, "pid");
    const root = `/proc/${pid}`;
    const stat = readFileSync(`${root}/stat`, "utf8");
    const fields = stat.slice(stat.lastIndexOf(")") + 2).split(" ");
    return { parent: Number(fields[1]), uid: lstatSync(root).uid, cwd: realpathSync(`${root}/cwd`), args: readFileSync(`${root}/cmdline`, "utf8").split("\0") };
  } catch { throw new Error("隔离进程已退出或身份不可核验"); }
}

/** 读取内核进程身份，不读取数据库口令、JWT 或后端 /proc/environ。 */
export function assertResourceProcesses(run, identity = processIdentity, currentPid = process.pid) {
  const pg = identity(run.resources.postgresPid);
  const redis = identity(run.resources.redisPid);
  ensure(pg.uid === process.getuid() && redis.uid === pg.uid && pg.cwd === join(run.root, "postgres") && redis.cwd === run.root
    && pg.parent > 1 && pg.parent === redis.parent, "数据进程不属于同一个活跃隔离 runner");
  ensure(pg.args.includes(`cluster_name=${run.manifest.runId}`) && pg.args.includes(join(run.root, "postgres"))
    && pg.args.includes(String(run.manifest.postgres.port)), "实际 PostgreSQL 集群身份不匹配");
  ensure(redis.args.join(" ").includes(`127.0.0.1:${run.manifest.redis.port}`), "实际 Redis 进程端口不匹配");
  let pid = currentPid;
  for (let depth = 0; depth < 64 && pid !== pg.parent && pid > 1; depth++) pid = identity(pid).parent;
  ensure(pid === pg.parent, "Web 必须作为当前资源 runner 的后代运行，禁止复用其他轮次");
}

/** 以本轮随机用户的匿名公开资料证明真实 API 数据来源；不通过登录来证明隔离。 */
export async function verifyRunProfile(run, origin, candidateId) {
  let response;
  let marker = !candidateId;
  try {
    if (candidateId) {
      // Next 外部 rewrite 的响应可能覆盖前端 headers；分别核验页面构建和真实代理数据。
      response = await fetch(`${origin}/`, { method: "HEAD", redirect: "manual", cache: "no-store", signal: AbortSignal.timeout(5000) });
      assertCandidateResponse(response, candidateId);
      marker = true;
    }
    for (let attempt = 0; attempt < 4; attempt++) {
      response = await fetch(`${origin}/api/v1/users/${encodeURIComponent(run.credentials.E2E_USER_ID)}`, {
        redirect: "manual", cache: "no-store", signal: AbortSignal.timeout(5000),
      });
      // 登录/刷新/保存可短时集中；只重试匿名身份 GET，保持业务限流与写入断言不变。
      if (response.status !== 429 || attempt === 3) break;
      await response.arrayBuffer();
      await new Promise((ok) => setTimeout(ok, 1000));
    }
    ensure(response.ok, "profile");
    const body = await response.json();
    ensure(body.data?.id === run.credentials.E2E_USER_ID && body.data?.username === run.credentials.E2E_USERNAME, "profile");
  } catch {
    const target = candidateId ? "候选代理" : "隔离后端";
    throw new Error(`${target}未返回本轮唯一身份（HTTP ${response?.status ?? "不可达"}，候选标识 ${marker ? "匹配" : "不匹配"}），拒绝登录或写入`);
  }
}

/** @param {Record<string, string | undefined>} env */
export async function requireIsolationRunner(env = process.env, candidate = true) {
  const run = readIsolation(env);
  assertResourceProcesses(run);
  await verifyRunProfile(run, run.manifest.backendURL);
  if (candidate) {
    ensure(env.WENYOU_E2E_CANDIDATE_ID && env.E2E_BUILD_DIR, "缺少本轮候选构建身份");
    const origin = isolatedOrigin(env.E2E_BASE_URL);
    ensure(origin !== run.manifest.backendURL, "候选前端不得直接复用后端端口");
    assertCandidateBuild(env.E2E_BUILD_DIR, env.WENYOU_E2E_CANDIDATE_ID, run.manifest.backendURL);
    await verifyRunProfile(run, origin, env.WENYOU_E2E_CANDIDATE_ID);
  }
  return run;
}
