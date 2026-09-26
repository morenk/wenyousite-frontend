import { isolatedOrigin } from "./e2e-candidate-policy.mjs";

export const PREVIEW_PROTOCOL_SHA = "4079ac84eba56a700a6228eab04521aff2d99925";
export function previewOrigin(value) {
  const origin = isolatedOrigin(value);
  const port = Number(new URL(origin).port);
  if (port < 1024 || [5432, 6379].includes(port)) throw new Error("预览端口不能使用系统或共享服务端口");
  return origin;
}

export function validateDescriptor(value) {
  if (value?.version !== 1 || value.kind !== "wenyou-dev-preview" || value.state !== "ready"
    || !/^[a-z][a-z0-9-]{2,47}$/.test(value.sessionId) || !/^preview_[a-f0-9]{24}$/.test(value.runId)
    || !/^[a-f0-9]{64}$/.test(value.snapshot?.sha256) || !/^[a-f0-9]{40}$/.test(value.snapshot?.sourceSha)
    || !/^\d{4}-\d{2}-\d{2}$/.test(value.snapshot?.businessDate) || !Number.isFinite(Date.parse(value.snapshot?.capturedAt))
    || typeof value.snapshot.migrationVersion !== "string" || !/^[a-f0-9]{40}$/.test(value.source?.backendSha)
    || typeof value.source.worktree !== "string" || !value.source.worktree.startsWith("/")
    || value.identity?.header !== "X-Wenyou-Preview-Run" || value.identity.value !== value.runId
    || value.ownership?.resourceId !== value.runId || !Number.isInteger(value.ownership.uid) || value.ownership.uid < 1) {
    throw new Error("预览消费者描述不完整或身份无效");
  }
  const ports = new Set();
  for (const role of ["backend", "media", "web"]) {
    const service = value[role];
    const origin = previewOrigin(service?.origin);
    if (!Number.isInteger(service.port) || service.port !== Number(new URL(origin).port) || ports.has(service.port)
      || (role !== "web" && service.identityUrl !== `${origin}/__preview/identity`)
      || (role === "backend" && service.apiBase !== `${origin}/api/v1`)) throw new Error("预览服务地址不一致");
    ports.add(service.port);
  }
  return value;
}

export async function verifyRuntime(descriptor, role, fetcher = fetch) {
  const expected = { version: 1, kind: descriptor.kind, sessionId: descriptor.sessionId, runId: descriptor.runId,
    role, resourceId: descriptor.runId, snapshotSha256: descriptor.snapshot.sha256 };
  const response = await fetcher(descriptor[role].identityUrl, { redirect: "error", cache: "no-store", signal: AbortSignal.timeout(5000) });
  if (response.status !== 200 || response.redirected || !response.headers.get("content-type")?.startsWith("application/json")
    || response.headers.get("x-wenyou-preview-run") !== descriptor.runId) throw new Error("预览运行响应身份不匹配");
  const actual = await response.json();
  if (Object.keys(actual).length !== Object.keys(expected).length || Object.entries(expected).some(([key, item]) => actual[key] !== item)) {
    throw new Error("预览运行资源身份不匹配");
  }
  return actual;
}

export function previewConfig(env) {
  if (!env.WENYOU_PREVIEW_RUN) return null;
  if (env.NODE_ENV !== "development" || env.WENYOU_E2E_CANDIDATE_ID || !/^preview_[a-f0-9]{24}$/.test(env.WENYOU_PREVIEW_RUN)
    || !/^[a-z][a-z0-9-]{2,47}$/.test(env.WENYOU_PREVIEW_SESSION) || !Number.isFinite(Date.parse(env.WENYOU_PREVIEW_SNAPSHOT))) {
    throw new Error("预览只能由已核验的独立开发入口启动");
  }
  return { runId: env.WENYOU_PREVIEW_RUN, sessionId: env.WENYOU_PREVIEW_SESSION, snapshot: env.WENYOU_PREVIEW_SNAPSHOT,
    proxyOrigin: previewOrigin(env.BACKEND_URL), mediaOrigin: previewOrigin(env.WENYOU_PREVIEW_MEDIA_ORIGIN) };
}
