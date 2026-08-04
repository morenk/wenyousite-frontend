/** API 快照安全检查：发现未脱敏的凭据、PII 或动态标识符时失败 */

import * as fs from "fs";
import * as path from "path";
import { sanitizeSnapshotValue } from "./snapshot-safety";

const snapshotDir = path.resolve("docs/snapshots");
const unsafeFiles: string[] = [];

for (const name of fs.readdirSync(snapshotDir).filter((file) => file.endsWith(".snapshot.json"))) {
  const file = path.join(snapshotDir, name);
  const original = JSON.parse(fs.readFileSync(file, "utf-8")) as unknown;
  if (JSON.stringify(original) !== JSON.stringify(sanitizeSnapshotValue(original))) {
    unsafeFiles.push(name);
  }
}

if (unsafeFiles.length > 0) {
  throw new Error(`以下 API 快照包含未脱敏数据：${unsafeFiles.join(", ")}。请运行 pnpm snapshots:sanitize`);
}

console.log("API snapshots are sanitized");
