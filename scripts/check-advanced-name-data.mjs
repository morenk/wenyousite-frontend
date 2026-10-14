import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";

const base = new URL("../", import.meta.url);
const read = (path) => readFileSync(new URL(path, base), "utf8");
const data = JSON.parse(read("src/lib/tools/advanced-name-data.json"));
const manifest = JSON.parse(read("src/lib/tools/advanced-name-manifest.json"));
const errors = [];
const check = (ok, message) => { if (!ok) errors.push(message); };
const text = (value) => typeof value === "string" && value.trim().length > 0;
const unique = (items, name) => check(new Set(items.map((x) => x.id)).size === items.length, name + " id 重复");
const sources = new Set(data.sources.map((x) => x.id));
const refs = (items, name) => check(Array.isArray(items) && items.length > 0 && items.every((id) => sources.has(id)), name + " 来源无效");
const entry = (part, name) => {
  check(part && text(part.original) && text(part.zh), name + " 缺原文/中译");
  if (part) check(!/[{}\r\n\t]/u.test(part.original + part.zh), name + " 含保留字符");
};
const sourcedPart = (part, name) => { entry(part, name); refs(part.sourceRefs, name); check(text(part.attestedAs), name + " 缺取材记录"); };
const tokenSet = (template) => [...new Set([...template.matchAll(/\{([^}]+)\}/g)].map((x) => x[1]))].sort();
check(data.schemaVersion === 2 && text(data.dataVersion), "数据版本无效");
unique(data.sources, "来源");
unique(data.styles, "风格");
for (const source of data.sources) {
  for (const field of ["id", "title", "url", "publisher", "license", "attribution", "provenance"]) check(text(source[field]), source.id + " 缺 " + field);
  check(["fact-reference-only", "licensed-reuse", "original-composition"].includes(source.usePolicy), source.id + " usePolicy 无效");
}
for (const style of data.styles) {
  check(["cn", "jp", "gb", "fr", "de", "ru"].includes(style.country), style.id + " 国家无效");
  check(["historical", "literary"].includes(style.mode), style.id + " 类型无效");
  refs(style.sourceRefs, style.id);
  check(!("byname" in style), style.id + " 禁止旧单数字段");
  check(text(style.label) && text(style.provenance), style.id + " 缺标签/来源类型");
  if (style.mode === "historical") {
    check(Number.isInteger(style.period?.from) && Number.isInteger(style.period?.to) && style.period.from <= style.period.to, style.id + " 年代无效");
  } else check(style.provenance === "original-composition", style.id + " 创作边界不明");
  for (const sex of ["male", "female"]) {
    check(style.given[sex]?.length >= 6, style.id + " 给名不足");
    unique(style.given[sex], style.id + "/" + sex);
    for (const part of style.given[sex]) sourcedPart(part, style.id + "/" + part.id);
    if (style.bynames) {
      check(style.bynames[sex]?.length > 0, style.id + " 别号缺性别池");
      unique(style.bynames[sex], style.id + "/byname/" + sex);
      for (const part of style.bynames[sex]) {
        sourcedPart(part, style.id + "/" + part.id);
        check(!style.given[sex].some((given) => given.original === part.original), style.id + " 别号与同性别给名重合");
      }
    }
  }
  check(style.families.length >= 3, style.id + " 姓氏不足");
  unique(style.families, style.id + "/family");
  for (const family of style.families) {
    refs(family.sourceRefs, style.id + "/" + family.id);
    check(text(family.attestedAs), style.id + " 姓氏缺取材记录");
    for (const sex of ["male", "female"]) entry(family.forms[sex] ?? family.forms.generic, style.id + "/" + family.id + "/" + sex);
  }
  if (style.patronymics) {
    unique(style.patronymics, style.id + "/patronymic");
    for (const part of style.patronymics) {
      refs(part.sourceRefs, style.id + "/" + part.id);
      for (const side of ["father", "male", "female"]) entry(part[side], style.id + "/" + part.id + "/" + side);
    }
  }
  unique(style.structures, style.id + "/structure");
  check(style.structures.some((x) => x.id === style.defaultStructureId), style.id + " 默认结构无效");
  for (const structure of style.structures) {
    const original = tokenSet(structure.originalTemplate);
    const zh = tokenSet(structure.zhTemplate);
    check(JSON.stringify(original) === JSON.stringify(zh), style.id + " 双语模板不同构");
    check(original.includes("given") && original.includes("family"), style.id + " 缺姓/名");
    check(original.every((x) => ["family", "given", "secondGiven", "patronymic", "byname"].includes(x)), style.id + " 未知模板参数");
    check(!/[{}]/u.test(structure.originalTemplate.replace(/\{[^}]+\}/g, "") + structure.zhTemplate.replace(/\{[^}]+\}/g, "")), style.id + " 模板大括号无效");
    if (original.includes("secondGiven")) for (const sex of ["male", "female"]) check(new Set(style.given[sex].map((x) => x.original)).size > 1, style.id + " 双名池不足");
    if (original.includes("patronymic")) check(style.patronymics?.length > 0, style.id + " 缺父称池");
    if (original.includes("byname")) check(style.mode === "literary" && !!style.bynames, style.id + " 史实禁止无证别号");
  }
}
for (const country of ["cn", "jp", "gb", "fr", "de", "ru"]) {
  const styles = data.styles.filter((x) => x.country === country);
  check(styles.filter((x) => x.mode === "literary").length >= 3, country + " 创作方向不足");
  check(styles.filter((x) => x.mode === "historical").length >= (country === "cn" ? 4 : 6), country + " 史实方向不足");
  for (const mode of ["historical", "literary"]) {
    const signatures = styles.filter((x) => x.mode === mode).map((x) => JSON.stringify({
      given: { male: x.given.male.map((p) => [p.original, p.zh]), female: x.given.female.map((p) => [p.original, p.zh]) }, family: x.families.map((f) => f.forms),
      structures: x.structures.map((s) => [s.originalTemplate, s.zhTemplate]),
    }));
    check(new Set(signatures).size === signatures.length, country + "/" + mode + " 存在仅改标签风格");
  }
}
check(manifest.schemaVersion === 2, "manifest 版本错误");
for (const file of manifest.files) {
  const hash = createHash("sha256").update(readFileSync(new URL(file.path, base))).digest("hex");
  check(hash === file.sha256, file.path + " SHA256 不符");
}
if (errors.length) { console.error(errors.join("\n")); process.exit(1); }
console.log("进阶起名 v2 数据、来源、结构及 SHA256 校验通过：" + data.styles.length + " 个风格");
