import { z } from "zod";
import type { components } from "@/api/types";
import schema from "../../contracts/thread-font-runtime-policy-v2.schema.json";
import { ceilings, validatedFontBase, type ThreadFontCatalog } from "./thread-font-protocol";
import type { FontSessionPolicy } from "./thread-font-session";
// Zod 的 JSON Schema 转换将数组 const 解释成多值 literal；改写成等价定长 tuple。
const normalizedSchema = JSON.parse(JSON.stringify(schema, (key, value) => {
  if (value && typeof value === "object" && Array.isArray(value.const)) {
    const { const: values, ...rest } = value;
    return { ...rest, prefixItems: values.map((item: unknown) => ({ const: item })), minItems: values.length, maxItems: values.length };
  }
  return value;
}));
const runtimePolicySchema = z.fromJSONSchema(normalizedSchema);
/** 仅接受已提交的严格策略及同 manifest 绑定；不信任远端放宽本地边界。 */
export function fontSessionPolicy(value: unknown, catalog: ThreadFontCatalog): FontSessionPolicy | null {
  const parsed = runtimePolicySchema.safeParse(value);
  if (!parsed.success || !validatedFontBase(catalog.assetBaseUrl)) return null;
  const policy = parsed.data as components["schemas"]["TextFontRuntimePolicyDto"];
  if (catalog.manifest?.sha256 !== policy.manifestSha256) return null;
  const { network, residency } = policy.web;
  return {
    manifestSha256: policy.manifestSha256,
    download: { concurrency: network.maxConcurrent, windowMs: network.windowMs, requestsPerWindow: network.maxRequests, bytesPerWindow: network.maxBytes, originalBytesPerWindow: 0 },
    residency: { families: residency.maxFamilies, faces: residency.maxFaces, bytes: residency.maxSfntBytes, originalBytes: 0 },
    transferTimeout: { mode: "progress", firstByteMs: network.timeoutMs, idleMs: network.timeoutMs, maxDurationMs: network.maxTransferMs },
    timeoutMs: network.timeoutMs, cacheBytes: ceilings.maxPersistentCacheBytes, maxAssetBytes: ceilings.maxAssetBytes,
    retryBaseMs: policy.retry.delayCeilingsMs[0]!, retryMaxMs: policy.retry.delayCeilingsMs.at(-1)!,
  };
}
