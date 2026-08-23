/** 将已锁定 Foundation 包中的 Web 品牌资源同步到 Next 静态资源。 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = process.cwd();
const foundationBrandModule = fileURLToPath(import.meta.resolve("@wenyousite/foundation/brand"));
const foundationRoot = path.resolve(path.dirname(foundationBrandModule), "..");

const assetTargets = new Map([
  ["brand/ui/title-icon-128.png", "public/brand-title-icon-128.png"],
  ["brand/web/favicon.ico", "src/app/favicon.ico"],
  ["brand/web/favicon-16x16.png", "public/favicon-16x16.png"],
  ["brand/web/favicon-32x32.png", "public/favicon-32x32.png"],
  ["brand/web/favicon-48x48.png", "public/favicon-48x48.png"],
  ["brand/web/apple-touch-icon.png", "public/apple-touch-icon.png"],
  ["brand/web/pwa-icon-192.png", "public/pwa-icon-192.png"],
  ["brand/web/pwa-icon-512.png", "public/pwa-icon-512.png"],
  ["brand/web/pwa-icon-1024.png", "public/pwa-icon-1024.png"],
  ["brand/web/pwa-icon-maskable-512.png", "public/pwa-icon-maskable-512.png"],
  ["brand/web/site.webmanifest", "public/site.webmanifest"],
]);

for (const [sourcePath, targetPath] of assetTargets) {
  const source = path.resolve(foundationRoot, sourcePath);
  const target = path.resolve(root, targetPath);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.copyFileSync(source, target);
}

console.log(`Synced ${assetTargets.size} Foundation Web brand assets`);
