/** 将后端契约同步到前端，候选分支可指定 BACKEND_CONTRACT_REF 精确提交。 */
import { mkdirSync, readFileSync, readdirSync, unlinkSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { backendContractSource } from "./backend-contract-source.mjs";

import { backendContractRoot } from "./backend-contract-root.mjs";

const boundaryName = "markdown-block-boundary-v1-fixtures.json";
function readBoundaryContract(body) {
  const fixture = JSON.parse(body);
  if (fixture.contract !== "wenyousite-markdown-block-boundary" || fixture.version !== 1
    || fixture.markdownContractVersion !== 5 || !Array.isArray(fixture.cases)) {
    throw new Error("后端块边界契约不是 Markdown v5 的 block-boundary v1");
  }
}
// 仅同步已提交产物导出的单份块边界契约，不夹带其他接口变化。
if (process.argv[2] === "--block-boundary-source") {
  if (!process.argv[3] || process.argv.length !== 4) throw new Error("需要一个已提交块边界契约路径");
  const body = readFileSync(process.argv[3], "utf8"); readBoundaryContract(body);
  mkdirSync(resolve(process.cwd(), "contracts"), { recursive: true });
  writeFileSync(resolve(process.cwd(), "contracts", boundaryName), body);
  console.log("Synced Markdown v5 block-boundary v1 fixture");
  process.exit(0);
}
if (process.argv.length > 2) throw new Error("未知契约同步参数");
const source = backendContractSource(backendContractRoot());
const target = resolve(process.cwd(), "contracts");
const contract = JSON.parse(source.read("openapi.json"));
if (!/^3\.0\./.test(contract.openapi ?? "") || !contract.info?.version) throw new Error("后端契约必须是有版本的 OpenAPI 3.0.x");
for (const [name, identity, version] of [
  ["internal-reference-v1-fixtures.json", "wenyousite-internal-reference", 1],
  ["editor-clipboard-v2-fixtures.json", "wenyousite-editor-clipboard", 2],
  ["markdown-editor-newline-v1-fixtures.json", "wenyousite-editor-newline", 1],
  ["markdown-editor-list-v1-fixtures.json", "wenyousite-editor-list", 1],
]) {
  const value = JSON.parse(source.read(name));
  if (value.contract !== identity || value.version !== version) throw new Error(name + " 契约不匹配");
}
readBoundaryContract(source.read(boundaryName));
const cover = JSON.parse(source.read("thread-cover-media-v1-fixtures.json"));
if (cover.schemaVersion !== 1 || !Array.isArray(cover.cases)) throw new Error("后端列表封面契约不是 v1");
const isMarkdown = (name) => /^markdown-(?:v\d+(?:-nodes|-image-alignment)?|editor-roundtrip-v\d+)-fixtures\.json$/.test(name);
const markdownFiles = source.list().filter(isMarkdown);
if (!markdownFiles.length) throw new Error("后端缺少 Markdown 契约");
for (const name of markdownFiles) {
  const value = JSON.parse(source.read(name));
  if (!value.contract?.startsWith("wenyousite-markdown") || !Number.isInteger(value.version)) throw new Error(name + " 契约无效");
}
const names = ["openapi.json", "internal-reference-v1-fixtures.json", "editor-clipboard-v2-fixtures.json",
  "markdown-editor-newline-v1-fixtures.json", "markdown-editor-list-v1-fixtures.json", "thread-cover-media-v1-fixtures.json", boundaryName, ...markdownFiles];
// 在写入前读取全部内容，来源缺失时不留下半套契约。
const contents = names.map((name) => [name, source.read(name)]);
mkdirSync(target, { recursive: true });
for (const [name, body] of contents) writeFileSync(resolve(target, name), body);
for (const name of readdirSync(target).filter(isMarkdown)) if (!markdownFiles.includes(name)) unlinkSync(resolve(target, name));
console.log("Synced API contract " + contract.info.version + " from " + source.description);
