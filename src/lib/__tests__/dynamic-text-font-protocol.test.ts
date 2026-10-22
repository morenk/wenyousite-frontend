import { expect, test } from "vitest";
import {
  dynamicFontAssetPath,
  dynamicFontDescriptorSchema,
  parseDynamicFontManifest,
  parseDynamicFontPolicy,
} from "../dynamic-text-font-protocol";
import policy from "../../../contracts/thread-font-runtime-policy-v3.json";
const asset = (format: string) => ({
  sha256: "a".repeat(64),
  bytes: 100,
  format,
});
const descriptor = {
  fontVersion: 2,
  versionId: "tfv_" + "a".repeat(32),
  familyId: "tff_" + "b".repeat(32),
  versionNumber: 1,
  name: "字体",
  designLanguage: "zh",
  revision: 1,
  status: "published",
  selectable: true,
  pasteAllowed: true,
  renderAllowed: true,
  assetBasePath:
    "/api/v1/meta/text-fonts/v2/versions/tfv_" + "a".repeat(32) + "/assets/",
  manifest: asset("json"),
  specimen: asset("png"),
};
const manifest = () => ({
  manifestVersion: 2,
  buildKey: "b".repeat(64),
  sourceSha256: "c".repeat(64),
  baseWeight: 400,
  baseStyle: "normal",
  coverage: { codepointCount: 2, unicodeRanges: ["U+0041-0042"] },
  shards: [
    {
      id: "core",
      family: "WYF2-" + "d".repeat(32) + "-core",
      unicodeRanges: ["U+0041-0042"],
      codepointCount: 2,
      web: asset("woff2"),
      mobile: asset("ttf"),
    },
  ],
  notices: [asset("json")],
  specimen: asset("png"),
});
test("严格状态及资产路径：历史版可粘贴，停用保留阅读，撤回无资源", () => {
  expect(
    dynamicFontDescriptorSchema.parse({ ...descriptor, selectable: false })
      .pasteAllowed,
  ).toBe(true);
  expect(
    dynamicFontDescriptorSchema.parse({
      ...descriptor,
      status: "disabled",
      selectable: false,
      pasteAllowed: false,
    }).renderAllowed,
  ).toBe(true);
  expect(
    dynamicFontDescriptorSchema.parse({
      ...descriptor,
      status: "withdrawn",
      selectable: false,
      pasteAllowed: false,
      renderAllowed: false,
      assetBasePath: null,
      manifest: null,
      specimen: null,
    }).renderAllowed,
  ).toBe(false);
  const value = dynamicFontDescriptorSchema.parse(descriptor);
  expect(dynamicFontAssetPath(value, value.manifest!)).toBe(
    descriptor.assetBasePath + "a".repeat(64) + ".json",
  );
  for (const mutation of [
    { pasteAllowed: false },
    { status: "withdrawn" },
    { status: "disabled" },
    { status: "preview" },
    { renderAllowed: false },
    { manifest: asset("woff2") },
    { specimen: asset("json") },
    { assetBasePath: "https://evil.test/" },
    { assetBasePath: descriptor.assetBasePath.replace("tfv_", "tff_") },
    { manifest: { ...asset("json"), bytes: 4194305 } },
    { extra: true },
  ])
    expect(
      dynamicFontDescriptorSchema.safeParse({ ...descriptor, ...mutation })
        .success,
    ).toBe(false);
});
test("已发布后台预览接受同版本私有路径，公共描述符仍拒绝该路径", () => {
  const value = dynamicFontDescriptorSchema.parse(descriptor);
  const preview = {
    ...value,
    assetBasePath: `/api/v1/admin/text-fonts/versions/${value.versionId}/assets/`,
  };
  expect(dynamicFontAssetPath(preview, preview.specimen!)).toBe(
    preview.assetBasePath + "a".repeat(64) + ".png",
  );
  expect(dynamicFontDescriptorSchema.safeParse(preview).success).toBe(false);
  for (const changed of [
    {
      assetBasePath: preview.assetBasePath.replace(
        value.versionId,
        "tfv_" + "c".repeat(32),
      ),
    },
    { assetBasePath: "https://evil.test" + preview.assetBasePath },
    { status: "withdrawn" as const },
  ])
    expect(() =>
      dynamicFontAssetPath({ ...preview, ...changed }, preview.specimen!),
    ).toThrow();
});
test("manifest允许正式导入WYF1 family；新字体使用WYF2且原生输入不可由URL指定", () => {
  const value = manifest();
  expect(parseDynamicFontManifest(value).shards).toHaveLength(1);
  value.shards[0]!.family = "WYF1-8d509802186f1b51-core";
  expect(parseDynamicFontManifest(value).shards[0]!.family).toBe(
    value.shards[0]!.family,
  );
  for (const family of [
    "Arial",
    "url(https://evil.test/font)",
    "WYF1-short-core",
  ]) {
    value.shards[0]!.family = family;
    expect(() => parseDynamicFontManifest(value)).toThrow();
  }
});
test.each([
  "count",
  "surrogate",
  "above-unicode",
  "reversed",
  "overlap",
  "gap",
  "duplicate-id",
  "wrong-format",
  "notice",
  "specimen",
])("清单语义校验拒绝%s", (kind) => {
  const value = manifest();
  const part = value.shards[0]!;
  switch (kind) {
    case "count":
      value.coverage.codepointCount = 3;
      break;
    case "surrogate":
      part.unicodeRanges = ["U+D800-D801"];
      break;
    case "above-unicode":
      part.unicodeRanges = ["U+110000-110001"];
      break;
    case "reversed":
      part.unicodeRanges = ["U+0042-0041"];
      break;
    case "overlap":
      value.shards.push({
        ...part,
        id: "other",
        family: part.family + "-other",
      });
      break;
    case "gap":
      part.unicodeRanges = ["U+0043-0044"];
      break;
    case "duplicate-id":
      value.shards.push({ ...part });
      break;
    case "wrong-format":
      part.web.format = "ttf";
      break;
    case "notice":
      value.notices[0]!.format = "png";
      break;
    case "specimen":
      value.specimen.format = "json";
  }
  expect(() => parseDynamicFontManifest(value)).toThrow();
});
test("策略使用共享schema，拒绝未知版本与遗留固定家族限额", () => {
  expect(parseDynamicFontPolicy(policy).policyVersion).toBe(3);
  expect(() =>
    parseDynamicFontPolicy({ ...policy, policyVersion: 2 }),
  ).toThrow();
  expect(() =>
    parseDynamicFontPolicy({
      ...policy,
      web: {
        ...policy.web,
        residency: { ...policy.web.residency, maxFamilies: 8 },
      },
    }),
  ).toThrow();
});

test("字体名称长度按Unicode码点而不是UTF16单元验证", () => {
  expect(
    dynamicFontDescriptorSchema.safeParse({
      ...descriptor,
      name: "𠀀".repeat(80),
    }).success,
  ).toBe(true);
  expect(
    dynamicFontDescriptorSchema.safeParse({
      ...descriptor,
      name: "𠀀".repeat(81),
    }).success,
  ).toBe(false);
});
