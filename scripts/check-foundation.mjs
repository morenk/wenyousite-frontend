/** 校验 Web 实际消费的设计基础与显式锁文件一致。 */

import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (relativePath) => fs.readFileSync(path.resolve(root, relativePath), "utf8");
const lock = JSON.parse(read("foundation.lock.json"));
const packageJson = JSON.parse(read("package.json"));
const manifest = JSON.parse(read("node_modules/@wenyousite/foundation/foundation-manifest.json"));
const failures = [];

if (packageJson.dependencies?.["@wenyousite/foundation"] !== `github:morenk/wenyousite-foundation#${lock.tag}`) {
  failures.push("package.json 未使用 foundation.lock.json 指定的不可变标签");
}
if (manifest.version !== lock.version) failures.push("已安装 foundation 版本与锁文件不一致");
if (manifest.contractSha256 !== lock.contractSha256) failures.push("已安装 foundation 契约哈希与锁文件不一致");
if (!read("pnpm-lock.yaml").includes(lock.revision)) failures.push("pnpm-lock.yaml 未锁定指定 foundation revision");

const layout = read("src/app/layout.tsx");
if (!layout.includes('@wenyousite/foundation/web/fonts.css')) failures.push("根布局未消费中央字体");
if (!layout.includes('@wenyousite/foundation/web/tokens.css')) failures.push("根布局未消费中央 Token");
if (/^:root\s*\{/mu.test(read("src/app/globals.css"))) failures.push("globals.css 不得复制中央 :root Token");

if (failures.length > 0) throw new Error(`Foundation 锁定检查失败：\n${failures.join("\n")}`);
console.log(`Web consumes wenyousite-foundation ${lock.version} (${lock.revision.slice(0, 7)})`);
