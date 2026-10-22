import { z } from "zod";
import manifestContract from "../../contracts/thread-font-manifest-v2.schema.json";
import policyContract from "../../contracts/thread-font-runtime-policy-v3.schema.json";
import type { components } from "@/api/types";
import type { DynamicFontDescriptor } from "./dynamic-text-font-state";
export type DynamicFontAsset = components["schemas"]["FontAssetDto"];
export interface DynamicFontShard {
  id: string;
  family: string;
  unicodeRanges: string[];
  codepointCount: number;
  web: DynamicFontAsset;
  mobile: DynamicFontAsset;
}
export interface DynamicFontManifest {
  manifestVersion: 2;
  buildKey: string;
  sourceSha256: string;
  baseWeight: 400;
  baseStyle: "normal";
  coverage: { codepointCount: number; unicodeRanges: string[] };
  shards: DynamicFontShard[];
  notices: DynamicFontAsset[];
  specimen: DynamicFontAsset;
}
export type DynamicFontPolicy =
  components["schemas"]["DynamicFontRuntimePolicyDto"];
const normalized = (value: unknown) =>
  JSON.parse(
    JSON.stringify(value, (_key, item) => {
      if (item && typeof item === "object" && Array.isArray(item.const)) {
        const { const: values, ...rest } = item;
        return {
          ...rest,
          prefixItems: values.map((value: unknown) => ({ const: value })),
          minItems: values.length,
          maxItems: values.length,
        };
      }
      return item;
    }),
  );
const manifestSchema = z.fromJSONSchema(normalized(manifestContract));
const policySchema = z.fromJSONSchema(normalized(policyContract));
export function parseDynamicFontPolicy(value: unknown): DynamicFontPolicy {
  return policySchema.parse(value) as DynamicFontPolicy;
}
const asset = z
  .object({
    sha256: z.string().regex(/^[a-f0-9]{64}$/u),
    bytes: z.number().int().positive().max(67108864),
    format: z.enum(["woff2", "ttf", "otf", "json", "png"]),
  })
  .strict();
function descriptorSchema(adminPreview = false) {
  return z
    .object({
      fontVersion: z.literal(2),
      versionId: z.string().regex(/^tfv_[a-f0-9]{32}$/u),
      familyId: z.string().regex(/^tff_[a-f0-9]{32}$/u),
      versionNumber: z.number().int().positive(),
      name: z.string().refine((value) => Array.from(value).length <= 80),
      designLanguage: z.enum(["zh", "ja", "en", "other"]),
      revision: z.number().int().nonnegative(),
      status: z.enum(["published", "disabled", "withdrawn", "preview"]),
      selectable: z.boolean(),
      pasteAllowed: z.boolean(),
      renderAllowed: z.boolean(),
      assetBasePath: z.string().nullable(),
      manifest: asset.nullable(),
      specimen: asset.nullable(),
    })
    .strict()
    .superRefine((value, ctx) => {
      const fail = () =>
        ctx.addIssue({ code: "custom", message: "无效的字体版本状态" });
      if (value.status === "withdrawn") {
        if (
          value.selectable ||
          value.pasteAllowed ||
          value.renderAllowed ||
          value.assetBasePath ||
          value.manifest ||
          value.specimen
        )
          fail();
        return;
      }
      if (
        !value.assetBasePath ||
        !value.manifest ||
        !value.specimen ||
        value.manifest.format !== "json" ||
        value.manifest.bytes > 4194304 ||
        value.specimen.format !== "png"
      ) {
        fail();
        return;
      }
      const expected = `/api/v1/${adminPreview || value.status === "preview" ? "admin/text-fonts" : "meta/text-fonts/v2"}/versions/${value.versionId}/assets/`;
      if (
        value.assetBasePath !== expected ||
        !value.renderAllowed ||
        (value.status === "published" && !value.pasteAllowed) ||
        (value.status === "disabled" &&
          (value.selectable || value.pasteAllowed)) ||
        (value.status === "preview" && (value.selectable || value.pasteAllowed))
      )
        fail();
    });
}
export const dynamicFontDescriptorSchema = descriptorSchema();
const adminPreviewDescriptorSchema = descriptorSchema(true);
export function dynamicFontAssetPath(
  descriptor: DynamicFontDescriptor,
  value: DynamicFontAsset,
): string {
  // 管理预览在发布、停用后仍返回私有地址；公共元数据解析继续严格限定公共路径。
  const schema =
    descriptor.assetBasePath ===
    `/api/v1/admin/text-fonts/versions/${descriptor.versionId}/assets/`
      ? adminPreviewDescriptorSchema
      : dynamicFontDescriptorSchema;
  const checked = schema.parse(descriptor);
  if (!checked.renderAllowed || !checked.assetBasePath)
    throw Error("font-withdrawn");
  return checked.assetBasePath + value.sha256 + "." + value.format;
}
function intervals(ranges: readonly string[]) {
  let previous = -1;
  return ranges.map((range) => {
    const [start, end = start] = range
      .slice(2)
      .split("-")
      .map((x) => parseInt(x, 16));
    if (
      start! <= previous ||
      start! > end! ||
      end! > 0x10ffff ||
      (start! <= 0xdfff && end! >= 0xd800)
    )
      throw Error("font-coverage");
    previous = end!;
    return [start!, end!] as [number, number];
  });
}
function merged(ranges: [number, number][]) {
  const result: [number, number][] = [];
  for (const [start, end] of ranges.sort((a, b) => a[0] - b[0])) {
    const previous = result.at(-1);
    if (previous && start <= previous[1])
      throw Error("font-overlapping-shards");
    if (previous && start === previous[1] + 1) previous[1] = end;
    else result.push([start, end]);
  }
  return result;
}
export function parseDynamicFontManifest(value: unknown): DynamicFontManifest {
  const manifest = manifestSchema.parse(value) as DynamicFontManifest;
  const coverage = intervals(manifest.coverage.unicodeRanges);
  const count = (items: [number, number][]) =>
    items.reduce((sum, [start, end]) => sum + end - start + 1, 0);
  if (
    count(coverage) !== manifest.coverage.codepointCount ||
    new Set(manifest.shards.map((s) => s.id)).size !== manifest.shards.length ||
    new Set(manifest.shards.map((s) => s.family)).size !==
      manifest.shards.length
  )
    throw Error("font-coverage");
  const all = manifest.shards.flatMap((shard) => {
    const ranges = intervals(shard.unicodeRanges);
    if (
      count(ranges) !== shard.codepointCount ||
      shard.web.format !== "woff2" ||
      !["ttf", "otf"].includes(shard.mobile.format)
    )
      throw Error("font-shard");
    return ranges;
  });
  if (
    JSON.stringify(merged(all)) !== JSON.stringify(merged(coverage)) ||
    manifest.notices.some((asset) => asset.format !== "json") ||
    manifest.specimen.format !== "png"
  )
    throw Error("font-manifest");
  const bytes = [
    ...manifest.shards.flatMap((s) => [s.web, s.mobile]),
    ...manifest.notices,
    manifest.specimen,
  ].reduce((sum, asset) => sum + asset.bytes, 0);
  if (bytes > 2 * 1024 * 1024 * 1024) throw Error("font-output-budget");
  return manifest;
}
