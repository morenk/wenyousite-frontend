import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import assert from "node:assert/strict";
const root = new URL("../", import.meta.url);
const read = async (path) => JSON.parse(await readFile(new URL(path, root), "utf8"));
const manifest = await read("src/lib/tools/historical-name-manifest.json");
assert.equal(manifest.schemaVersion, 1);
for (const [path, hash] of Object.entries(manifest.files)) {
  assert.equal(createHash("sha256").update(await readFile(new URL(path, root))).digest("hex"), hash, "历史姓名数据漂移：" + path);
}
const data = await read("src/lib/tools/historical-name-data.json");
const fixtures = await read("src/lib/tools/historical-name-fixtures.json");
assert.equal(data.schemaVersion, 1);
assert.equal(data.dataVersion, manifest.dataVersion);
assert.equal(fixtures.dataVersion, data.dataVersion);
const unique = (items) => assert.equal(new Set(items).size, items.length, "重复 ID");
unique(data.sources.map((item) => item.id));
unique(data.profiles.map((item) => item.id));
const sources = new Set(data.sources.map((item) => item.id));
const refs = (value) => { assert.ok(value.length > 0); value.forEach((id) => assert.ok(sources.has(id), "无效来源：" + id)); };
const name = (value) => {
  assert.ok(value.original && value.original.trim() === value.original);
  assert.ok(value.zh && value.zh.trim() === value.zh);
  assert.match(value.zh, /^[\p{Script=Han}·・\- ]+$/u);
  assert.match(value.zh, /\p{Script=Han}/u);
  assert.ok(!/[\r\n\t]/.test(value.original + value.zh));
};
for (const source of data.sources) {
  for (const key of ["id", "title", "url", "publisher", "license", "usePolicy", "attribution", "provenance"]) assert.ok(source[key]);
  assert.ok(["fact-reference-only", "licensed-reuse"].includes(source.usePolicy));
  assert.ok(source.url.startsWith("https://"));
}
assert.deepEqual([...new Set(data.profiles.map((item) => item.country))].sort(), ["cn", "de", "fr", "gb", "jp", "ru"]);
assert.equal(data.profiles.length, 12);
for (const profile of data.profiles) {
  assert.ok(profile.label && profile.region && profile.period.from <= profile.period.to);
  refs(profile.sourceRefs);
  const east = ["cn", "jp"].includes(profile.country);
  assert.deepEqual(profile.namePattern, east ? ["family", "given"] : profile.country === "ru" ? ["given", "patronymic", "family"] : ["given", "family"]);
  assert.equal(profile.originalSeparator, east ? "" : " ");
  assert.equal(profile.zhSeparator, east ? "" : "·");
  for (const sex of ["female", "male"]) {
    const given = profile.given[sex];
    assert.ok(given.length >= 6);
    unique(given.map((item) => item.id)); unique(given.map((item) => item.original));
    for (const item of given) { name(item); refs(item.sourceRefs); assert.ok(item.attestedAs); }
  }
  assert.ok(profile.families.length >= 6);
  unique(profile.families.map((item) => item.id));
  for (const family of profile.families) {
    for (const sex of ["female", "male"]) name(family.forms[sex] ?? family.forms.generic);
    refs(family.sourceRefs); assert.ok(family.attestedAs);
    if (family.lineage) { refs(family.lineage.sourceRefs); assert.ok(family.lineage.label && family.lineage.evidence); }
  }
  unique(profile.roles.map((item) => item.id));
  assert.ok(profile.roles.some((item) => item.id === "period"));
  for (const role of profile.roles) {
    assert.ok(["period", "lineage"].includes(role.id) && role.label);
    assert.ok(role.familyIds.length >= 3); unique(role.familyIds);
    for (const id of role.familyIds) {
      const family = profile.families.find((item) => item.id === id);
      assert.ok(family, "家族引用不存在");
      if (role.id === "lineage") assert.ok(family.lineage);
    }
    if (role.period) assert.ok(role.period.from >= profile.period.from && role.period.to <= profile.period.to && role.period.from <= role.period.to);
  }
  if (profile.country === "cn") assert.deepEqual(profile.roles.map((item) => item.id), ["period"]);
  if (profile.id === "jp-meiji") assert.equal(profile.roles.find((item) => item.id === "lineage").period.from, 1884);
  assert.equal(!!profile.patronymics?.length, profile.namePattern.includes("patronymic"));
  if (profile.patronymics) {
    assert.equal(profile.country, "ru"); assert.ok(profile.patronymics.length >= 5);
    unique(profile.patronymics.map((item) => item.id));
    for (const patron of profile.patronymics) {
      name(patron.father); name(patron.male); name(patron.female); refs(patron.sourceRefs); assert.ok(patron.attestedAs);
    }
  }
}
unique(fixtures.cases.map((item) => item.id));
assert.equal(await readFile(new URL("public/licenses/historical-names.txt", root), "utf8"), await readFile(new URL(manifest.license, root), "utf8"));
console.log("历史姓名12个包：双性别、来源、家族矩阵、父称、SHA-256 与许可证一致");
