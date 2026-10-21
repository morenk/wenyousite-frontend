import { z } from "zod";
import type { components } from "@/api/types";
import { normalizeTextFont } from "@/lib/markdown-text-font";

export type ThreadFontCatalog = components["schemas"]["TextFontCatalogDto"];
const hash = z.string().regex(/^[a-f0-9]{64}$/u);
export const asset = z.object({ path: z.string().regex(/^fonts\/v1\/[a-f0-9]{64}\.(?:woff2|ttf|otf|json|txt)$/u), sha256: hash, bytes: z.number().int().positive().max(6 * 1024 * 1024) }).refine((a) => a.path.split("/").at(-1)?.split(".")[0] === a.sha256);
// 来自已提交 manifest schema 的唯一原件例外；回归与契约完整对象比较，不能由远端扩大。
const originalHash = "cf4a4215e562d6de6e3ee88f25fc5d47d77668d28eb3a0f2533c7290de307423";
export const originalBytes = 18410600;
export const originalAsset = z.object({ path: z.literal(`fonts/v1/${originalHash}.ttf`), sha256: z.literal(originalHash), bytes: z.literal(originalBytes), format: z.literal("ttf"), contentType: z.literal("font/ttf") });
const originalBudget = z.object({ kind: z.literal("original-source"), assetSha256: z.literal(originalHash), assetBytes: z.literal(originalBytes), additionalSessionBytes: z.literal(originalBytes) }).strict();
const ranges = z.array(z.string().regex(/^U\+[0-9A-F]{4,6}(?:-[0-9A-F]{4,6})?$/u)).max(100000).refine((items) => items.every((range) => {
  const [from, to = from] = range.slice(2).split("-").map((v) => parseInt(v, 16));
  return from! <= to! && to! <= 0x10ffff;
}));
const mobileAsset = asset.and(z.object({ format: z.enum(["ttf", "otf"]), contentType: z.enum(["font/ttf", "font/otf"]) })).refine(a => a.path.endsWith("." + a.format) && a.contentType === "font/" + a.format);
const shard = z.object({ id: z.string().regex(/^(?:core|u[0-9a-f]{6})$/u), family: z.string().regex(/^WYF1-[0-9a-f]{16}-(?:core|u[0-9a-f]{6})$/u), unicodeRanges: ranges, mobile: mobileAsset.optional(), web: asset.refine((a) => a.path.endsWith(".woff2")).and(z.object({ format: z.literal("woff2"), contentType: z.literal("font/woff2") })) });
const originalShard = z.object({ id: z.literal("original"), family: z.literal(`WYF1-${originalHash.slice(0, 16)}-original`), unicodeRanges: ranges, mobile: originalAsset.optional(), web: originalAsset });
const readyBase = z.object({ id: z.string().refine((id) => !!normalizeTextFont(id)), availability: z.literal("ready"), baseWeight: z.literal(400), baseStyle: z.literal("normal"), notices: z.array(asset).min(2).max(16) });
const readyFont = z.discriminatedUnion("deliveryMode", [
  readyBase.extend({ deliveryMode: z.literal("subset"), id: z.string().refine((id) => !!normalizeTextFont(id) && id !== "xiaocheng-lafeng"), license: z.enum(["OFL-1.1", "Apache-2.0"]), budgetException: z.never().optional(), shards: z.array(shard).min(1).max(1024) }),
  readyBase.extend({ deliveryMode: z.literal("original"), id: z.literal("xiaocheng-lafeng"), license: z.literal("LicenseRef-ProjectAuthorization"), fontSha256: z.literal(originalHash), budgetException: originalBudget, shards: z.array(originalShard).length(1) }),
]);
export const threadFontManifestSchema = z.object({
  schemaVersion: z.literal(1), fontVersion: z.literal(1), catalogVersion: z.string(),
  limits: z.object({ maxConcurrentDownloads: z.number().int().positive(), maxSessionFamilies: z.number().int().positive(), maxSessionRequests: z.number().int().positive(), maxWebSessionBytes: z.number().int().positive(), maxPersistentCacheBytes: z.number().int().positive(), downloadTimeoutMs: z.number().int().positive(), maxAssetBytes: z.number().int().positive() }),
  fonts: z.array(z.union([readyFont, z.object({ id: z.string(), availability: z.literal("pendingSource"), shards: z.array(z.unknown()).length(0) })])).max(100),
});
export type ThreadFontManifest = z.infer<typeof threadFontManifestSchema>;
export type ThreadFontShard = z.infer<typeof shard> | z.infer<typeof originalShard>;
export type Asset = z.infer<typeof asset> | z.infer<typeof originalAsset>;
export const ceilings = { maxConcurrentDownloads: 2, maxSessionFamilies: 8, maxSessionRequests: 64, maxWebSessionBytes: 16 * 1024 * 1024, maxPersistentCacheBytes: 64 * 1024 * 1024, downloadTimeoutMs: 15000, maxAssetBytes: 6 * 1024 * 1024 };
export function rangesContain(ranges: readonly string[], codepoint: number): boolean {
  return ranges.some((range) => { const [start, end = start] = range.slice(2).split("-").map((v) => parseInt(v, 16)); return codepoint >= start! && codepoint <= end!; });
}
export function requiredFontShards(shards: readonly ThreadFontShard[], text: string) {
  const points = [...new Set(Array.from(text, (letter) => letter.codePointAt(0)!))];
  return shards.filter((part) => points.some((point) => rangesContain(part.unicodeRanges, point)));
}
export function validatedFontBase(value: string | null): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash || !url.pathname.endsWith("/")) return null;
    // 后端运营配置只能把客户端引向站点自有字体来源，不能变成任意第三方资源代理。
    if (url.hostname !== "wenyou.site" && !url.hostname.endsWith(".wenyou.site")) return null;
    return url.href;
  } catch { return null; }
}
export async function verifyFontBytes(bytes: ArrayBuffer, descriptor: Asset): Promise<boolean> {
  if (bytes.byteLength !== descriptor.bytes) return false;
  const actual = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)), (b) => b.toString(16).padStart(2, "0")).join("");
  return actual === descriptor.sha256;
}
export type FontLoadResult = { family: string; status: "ready" | "fallback"; reason?: string };
export const systemFamily = "var(--wenyou-font-body-family, system-ui)";
