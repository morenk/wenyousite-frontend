import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import assert from "node:assert/strict";
const root = new URL("../", import.meta.url);
const manifest = JSON.parse(await readFile(new URL("src/lib/tools/name-data-manifest.json", root), "utf8"));
assert.equal(manifest.schemaVersion, 1);
for (const [path, hash] of Object.entries(manifest.files)) {
  assert.equal(createHash("sha256").update(await readFile(new URL(path, root))).digest("hex"), hash, "姓名数据内容漂移：" + path);
}
const data = JSON.parse(await readFile(new URL("src/lib/tools/bilingual-name-data.json", root), "utf8"));
assert.equal(data.schemaVersion, 1);
assert.equal(data.dataVersion, manifest.dataVersion);
assert.equal(Object.keys(data.countries).length, 10);
for (const country of Object.values(data.countries)) {
  for (const part of [country.given, country.family]) {
    for (const sex of ["male", "female"]) {
      const entries = part[sex] ?? part.generic;
      assert.ok(entries.length >= 20);
      assert.equal(new Set(entries.map((entry) => entry.original.toLowerCase())).size, entries.length);
      for (const entry of entries) {
        assert.ok(entry.original.trim() && entry.original === entry.original.trim());
        assert.match(entry.zh, /^[\p{Script=Han}]+$/u);
      }
    }
  }
}
assert.equal(await readFile(new URL("public/licenses/wenyou-names.txt", root), "utf8"), await readFile(new URL("src/lib/tools/name-data/LICENSE.wenyou.txt", root), "utf8"));
console.log("双语姓名 schema、完整中文对照、文件 SHA-256 与许可一致");
