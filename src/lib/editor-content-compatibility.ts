import { findUnsupportedMarkdownFormats } from "@/lib/markdown";

interface ContentProfile { markdownVersions: number[]; features: string[] }
const base = ["base"];
const aligned = [...base, "block-alignment"];
const images = [...aligned, "image-alignment"];
const protection = ["quote-empty-row", "newline-r2", "lossless-save-guard"];
const profiles: Record<string, ContentProfile> = {
  "legacy-v3": { markdownVersions: [3], features: base },
  "legacy-v4": { markdownVersions: [3, 4], features: aligned },
  "legacy-v5": { markdownVersions: [3, 4, 5], features: images },
  "candidate-v5": { markdownVersions: [3, 4, 5], features: [...images, ...protection] },
};

/** 版本号只用于已知能力边界；不能把未知版本视为更强的兼容版本。 */
function assess(markdown: string, profile: ContentProfile | undefined, lossless: boolean) {
  const deny = (reason: string, read = "safe-fallback") => ({ read, create: false, edit: false, reason });
  if (!profile) return deny("unknown-profile");
  markdown = markdown.replace(/\r\n?/gu, "\n");
  if (findUnsupportedMarkdownFormats(markdown, { markdownContractVersion: 5 }).length > 0)
    return deny("unsupported-markdown");
  const required = new Set(["base"]);
  if (/^\[wenyousite-align-v1-(?:center|right)\]: #$/mu.test(markdown)) required.add("block-alignment");
  if (/^\[wenyousite-align-v1-(?:center|right)\]: #\n!\[/mu.test(markdown)) required.add("image-alignment");
  if (/^> <br \/>$/mu.test(markdown)) required.add("quote-empty-row");
  if ([...required].some((feature) => !profile.features.includes(feature))) return deny("missing-feature");
  if (!lossless) return deny("lossy-roundtrip", "full");
  return { read: "full", create: true, edit: true, reason: "supported" };
}

/** 声明能力矩阵用于离线对照，不推断旧客户端实际支持。 */
export function assessEditorCompatibility(markdown: string, profile: string, lossless = true) {
  return assess(markdown, Object.hasOwn(profiles, profile) ? profiles[profile] : undefined, lossless);
}

/** 当前 Web 具备读取和失效保护，写能力还必须满足已知服务端版本。 */
export function assessEditorInput(markdown: string, markdownContractVersion: number) {
  const profile = profiles[`legacy-v${markdownContractVersion}`];
  return assess(markdown, profile ? { ...profile, features: [...profile.features, ...protection] } : undefined, true);
}
