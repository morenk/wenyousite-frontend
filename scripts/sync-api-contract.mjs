/** 将后端已审核 OpenAPI 产物同步到前端，不从运行中实例或源码临时导出。 */

import { copyFileSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

const frontendRoot = process.cwd();
const source = resolve(frontendRoot, "../wenyousite-backend/contracts/openapi.json");
const target = resolve(frontendRoot, "contracts/openapi.json");
const contract = JSON.parse(readFileSync(source, "utf8"));

if (!/^3\.0\./.test(contract.openapi ?? "")) {
  throw new Error(`后端契约不是 OpenAPI 3.0.x：${contract.openapi ?? "missing"}`);
}
if (!contract.info?.version) throw new Error("后端契约缺少 info.version");

mkdirSync(dirname(target), { recursive: true });
copyFileSync(source, target);
console.log(`Synced API contract ${contract.info.version} to contracts/openapi.json`);
