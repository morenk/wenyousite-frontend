/** 已有 API 快照清洗脚本：原地移除凭据、PII 和稳定标识符 */

import * as fs from "fs";
import * as path from "path";
import { sanitizeSnapshotValue } from "./snapshot-safety";

const snapshotDir = path.resolve("docs/snapshots");

for (const name of fs.readdirSync(snapshotDir).filter((file) => file.endsWith(".snapshot.json"))) {
  const file = path.join(snapshotDir, name);
  const snapshot = JSON.parse(fs.readFileSync(file, "utf-8")) as unknown;
  fs.writeFileSync(file, `${JSON.stringify(sanitizeSnapshotValue(snapshot), null, 2)}\n`, "utf-8");
  console.log(`sanitized ${name}`);
}
