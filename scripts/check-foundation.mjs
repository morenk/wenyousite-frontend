/** 校验 Web 实际消费的设计基础与显式锁文件一致。 */

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const root = process.cwd();
const read = (relativePath) => fs.readFileSync(path.resolve(root, relativePath), "utf8");
const sha256 = (filePath) => crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");
const lock = JSON.parse(read("foundation.lock.json"));
const packageJson = JSON.parse(read("package.json"));
const manifest = JSON.parse(read("node_modules/@wenyousite/foundation/foundation-manifest.json"));
const foundationContract = JSON.parse(read("node_modules/@wenyousite/foundation/contracts/foundation.v1.json"));
const openapi = JSON.parse(read("contracts/openapi.json"));
const failures = [];
const repositoryOnlyArtifacts = new Set([
  "packages/flutter/lib/src/foundation_tokens.dart",
  "packages/flutter/lib/src/foundation_formatters.dart",
  "packages/flutter/lib/src/foundation_brand.dart",
  "packages/flutter/lib/src/wenyou_icons.dart",
]);

if (packageJson.dependencies?.["@wenyousite/foundation"] !== `github:morenk/wenyousite-foundation#${lock.tag}`) {
  failures.push("package.json 未使用 foundation.lock.json 指定的不可变标签");
}
if (manifest.version !== lock.version) failures.push("已安装 foundation 版本与锁文件不一致");
if (manifest.contractSha256 !== lock.contractSha256) failures.push("已安装 foundation 契约哈希与锁文件不一致");
if (!read("pnpm-lock.yaml").includes(lock.revision)) failures.push("pnpm-lock.yaml 未锁定指定 foundation revision");
if (foundationContract.version !== "7.4.0" || foundationContract.schemaVersion !== 3) {
  failures.push("Web 必须消费 Foundation v7.4.0 schema 3 契约");
}
if (foundationContract.experiences.editor.textColor?.web?.picker !== false
  || foundationContract.experiences.editor.textColor?.web?.existingContent !== "render-edit-preserve"
  || foundationContract.experiences.editor.textColor?.web?.clipboard !== "preserve-color"
  || foundationContract.experiences.editor.textColor?.colorModel !== "opaque-rgb") {
  failures.push("Foundation 缺少 Web 颜色保源且不开放取色的契约");
