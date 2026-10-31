import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { motionViolations } from "./motion-policy.mjs";

function files(root) {
  return readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    const path = join(root, entry.name);
    return entry.isDirectory() ? entry.name === "__tests__" ? [] : files(path)
      : /\.(tsx?|css)$/.test(path) ? [path] : [];
  });
}
const failures = files("src").flatMap((file) => motionViolations(readFileSync(file, "utf8"), file).map((message) => `${file}: ${message}`));
if (failures.length) throw new Error(failures.join("\n"));
console.log("全项目动效使用 Foundation Token、明确属性与减少动画滚动入口");
