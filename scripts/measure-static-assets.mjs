/** 同口径统计可由浏览器下载的静态文件；不重复计算 standalone 副本或构建缓存。 */
import { createHash } from "node:crypto";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { resolve, relative, extname } from "node:path";

const buildRoot = resolve(process.argv[2] ?? ".next");
const publicRoot = resolve("public");
const files = [];
for (const [label, root] of [[".next/static", resolve(buildRoot, "static")], ["public", publicRoot]]) {
  function walk(directory) {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const file = resolve(directory, entry.name);
      if (entry.isDirectory()) walk(file);
      else if (entry.isFile()) files.push({
        path: `${label}/${relative(root, file)}`,
        bytes: statSync(file).size,
        sha256: createHash("sha256").update(readFileSync(file)).digest("hex"),
      });
    }
  }
  walk(root);
}
files.sort((a, b) => a.path.localeCompare(b.path, "en"));
const groups = {};
for (const file of files) {
  const extension = extname(file.path);
  const key = /\.(woff2?|ttf|otf|eot)$/i.test(extension) ? "fonts" : extension;
  const group = groups[key] ??= { files: 0, bytes: 0 };
  group.files++;
  group.bytes += file.bytes;
}
console.log(JSON.stringify({
  scope: [".next/static", "public"],
  buildId: readFileSync(resolve(buildRoot, "BUILD_ID"), "utf8").trim(),
  files: files.length,
  bytes: files.reduce((sum, file) => sum + file.bytes, 0),
  groups,
  inventorySha256: createHash("sha256").update(JSON.stringify(files)).digest("hex"),
}, null, 2));
