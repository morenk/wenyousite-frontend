/** 将后端已审核 OpenAPI 产物同步到前端，不从运行中实例或源码临时导出。 */

import { copyFileSync, mkdirSync, readFileSync, readdirSync, unlinkSync } from "node:fs";
import { dirname, resolve } from "node:path";

const frontendRoot = process.cwd();
const source = resolve(frontendRoot, "../wenyousite-backend/contracts/openapi.json");
const target = resolve(frontendRoot, "contracts/openapi.json");
const internalReferenceSource = resolve(
  frontendRoot,
  "../wenyousite-backend/contracts/internal-reference-v1-fixtures.json",
);
const internalReferenceTarget = resolve(
  frontendRoot,
  "contracts/internal-reference-v1-fixtures.json",
);
const editorClipboardSource = resolve(
  frontendRoot,
  "../wenyousite-backend/contracts/editor-clipboard-v2-fixtures.json",
);
const editorClipboardTarget = resolve(
  frontendRoot,
  "contracts/editor-clipboard-v2-fixtures.json",
);
const newlineSource = resolve(frontendRoot, "../wenyousite-backend/contracts/markdown-editor-newline-v1-fixtures.json");
const newlineTarget = resolve(frontendRoot, "contracts/markdown-editor-newline-v1-fixtures.json");
const newlineContract = JSON.parse(readFileSync(newlineSource, "utf8"));
if (newlineContract.contract !== "wenyousite-editor-newline" || newlineContract.version !== 1) {
  throw new Error("后端回车契约不是 wenyousite-editor-newline v1");
}
const contract = JSON.parse(readFileSync(source, "utf8"));
const internalReferenceContract = JSON.parse(readFileSync(internalReferenceSource, "utf8"));
const editorClipboardContract = JSON.parse(readFileSync(editorClipboardSource, "utf8"));

if (!/^3\.0\./.test(contract.openapi ?? "")) {
  throw new Error(`后端契约不是 OpenAPI 3.0.x：${contract.openapi ?? "missing"}`);
}
if (!contract.info?.version) throw new Error("后端契约缺少 info.version");
if (
  internalReferenceContract.contract !== "wenyousite-internal-reference"
  || internalReferenceContract.version !== 1
) {
  throw new Error("后端站内传送门契约不是 wenyousite-internal-reference v1");
}
if (
  editorClipboardContract.contract !== "wenyousite-editor-clipboard"
  || editorClipboardContract.version !== 2
) {
  throw new Error("后端编辑器剪贴板契约不是 wenyousite-editor-clipboard v2");
}

const backendContracts = dirname(source);
const behaviorFiles = ["rich-text-behavior-v1-fixtures.json", "rich-text-behavior-v1.schema.json", "rich-text-behavior-results-v1.schema.json"];
for (const name of behaviorFiles) {
  const value = JSON.parse(readFileSync(resolve(backendContracts, name), "utf8"));
  if (name.endsWith("-fixtures.json")
    ? value.contract !== "wenyousite-rich-text-behavior" || value.version !== 1
    : value.$schema !== "http://json-schema.org/draft-07/schema#") {
    throw new Error(`后端富文本行为契约无效：${name}`);
  }
}
const frontendContracts = dirname(target);
const isMarkdownFixture = (name) => /^markdown-(?:v\d+(?:-nodes|-image-alignment)?|editor-roundtrip-v\d+)-fixtures\.json$/.test(name);
const markdownFiles = readdirSync(backendContracts).filter(isMarkdownFixture);
if (markdownFiles.length === 0) throw new Error("后端缺少 Markdown 契约");
for (const name of markdownFiles) {
  const fixture = JSON.parse(readFileSync(resolve(backendContracts, name), "utf8"));
  if (!fixture.contract?.startsWith("wenyousite-markdown") || !Number.isInteger(fixture.version)) {
    throw new Error(`后端 Markdown 契约无效：${name}`);
  }
}

mkdirSync(frontendContracts, { recursive: true });
copyFileSync(source, target);
copyFileSync(newlineSource, newlineTarget);
for (const name of behaviorFiles) copyFileSync(resolve(backendContracts, name), resolve(frontendRoot, "contracts", name));
copyFileSync(internalReferenceSource, internalReferenceTarget);
copyFileSync(editorClipboardSource, editorClipboardTarget);
for (const name of markdownFiles) {
  copyFileSync(resolve(backendContracts, name), resolve(frontendContracts, name));
}
for (const name of readdirSync(frontendContracts).filter(isMarkdownFixture)) {
  if (!markdownFiles.includes(name)) unlinkSync(resolve(frontendContracts, name));
}
console.log(
  `Synced API contract ${contract.info.version}, internal-reference v1, editor-clipboard v2 and ${markdownFiles.length} Markdown fixtures`,
);
