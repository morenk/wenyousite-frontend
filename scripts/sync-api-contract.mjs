/** 将后端已审核 OpenAPI 产物同步到前端，不从运行中实例或源码临时导出。 */

import { copyFileSync, mkdirSync, readFileSync, readdirSync, unlinkSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { backendContractRoot } from "./backend-contract-root.mjs";

const frontendRoot = process.cwd();
const boundaryName = "markdown-block-boundary-v1-fixtures.json";
function readBoundaryContract(sourcePath) {
  const fixture = JSON.parse(readFileSync(sourcePath, "utf8"));
  if (fixture.contract !== "wenyousite-markdown-block-boundary" || fixture.version !== 1
    || fixture.markdownContractVersion !== 5 || !Array.isArray(fixture.cases)) {
    throw new Error("后端块边界契约不是 Markdown v5 的 block-boundary v1");
  }
  return fixture;
}

// 独立 Worktree 可从明确 Git SHA 导出的单份契约同步，避免夹带其他接口变化。
if (process.argv[2] === "--block-boundary-source") {
  const boundarySource = process.argv[3];
  if (!boundarySource || process.argv.length !== 4) throw new Error("需要一个已提交块边界契约路径");
  readBoundaryContract(boundarySource);
  mkdirSync(resolve(frontendRoot, "contracts"), { recursive: true });
  copyFileSync(boundarySource, resolve(frontendRoot, "contracts", boundaryName));
  console.log("Synced Markdown v5 block-boundary v1 fixture");
  process.exit(0);
}
if (process.argv.length > 2) throw new Error("未知契约同步参数");
const backendRoot = backendContractRoot(frontendRoot);
const source = resolve(backendRoot, "contracts/openapi.json");
const target = resolve(frontendRoot, "contracts/openapi.json");
const internalReferenceSource = resolve(
  backendRoot,
  "contracts/internal-reference-v1-fixtures.json",
);
const internalReferenceTarget = resolve(
  frontendRoot,
  "contracts/internal-reference-v1-fixtures.json",
);
const editorClipboardSource = resolve(
  backendRoot,
  "contracts/editor-clipboard-v2-fixtures.json",
);
const editorClipboardTarget = resolve(
  frontendRoot,
  "contracts/editor-clipboard-v2-fixtures.json",
);
const newlineSource = resolve(backendRoot, "contracts/markdown-editor-newline-v1-fixtures.json");
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
const frontendContracts = dirname(target);
const boundarySource = resolve(backendContracts, boundaryName);
readBoundaryContract(boundarySource);
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
copyFileSync(internalReferenceSource, internalReferenceTarget);
copyFileSync(editorClipboardSource, editorClipboardTarget);
copyFileSync(boundarySource, resolve(frontendContracts, boundaryName));
for (const name of markdownFiles) {
  copyFileSync(resolve(backendContracts, name), resolve(frontendContracts, name));
}
for (const name of readdirSync(frontendContracts).filter(isMarkdownFixture)) {
  if (!markdownFiles.includes(name)) unlinkSync(resolve(frontendContracts, name));
}
console.log(
  `Synced API contract ${contract.info.version}, internal-reference v1, editor-clipboard v2 and ${markdownFiles.length} Markdown fixtures`,
);
