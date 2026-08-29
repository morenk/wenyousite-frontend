/** 将后端已审核 OpenAPI 产物同步到前端，不从运行中实例或源码临时导出。 */

import { copyFileSync, mkdirSync, readFileSync } from "node:fs";
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

mkdirSync(dirname(target), { recursive: true });
copyFileSync(source, target);
copyFileSync(internalReferenceSource, internalReferenceTarget);
copyFileSync(editorClipboardSource, editorClipboardTarget);
console.log(
  `Synced API contract ${contract.info.version}, internal-reference v1 and editor-clipboard v2 fixtures`,
);
