/** 从固定版本 Faker 提取姓名数据；不把完整 Faker 放入浏览器。 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import * as locales from "@faker-js/faker";
const countries = { cn: "zh_CN", jp: "ja", gb: "en_GB", de: "de", fr: "fr", ru: "ru", us: "en_US", it: "it", es: "es", kr: "ko", br: "pt_BR" };
const target = new URL("../src/lib/tools/name-data/", import.meta.url);
await mkdir(target, { recursive: true });
const check = process.argv.includes("--check");
for (const [country, locale] of Object.entries(countries)) {
  const person = locales[locale].person;
  const englishFallback = locale === "en_GB" || locale === "en_US";
  const given = person.first_name ?? (englishFallback ? locales.en.person.first_name : undefined);
  const family = person.last_name ?? (englishFallback ? locales.en.person.last_name : undefined);
  if (!given || !family) throw new Error(`${locale}: 姓名词库缺失，不能静默回退英文`);
  for (const sex of ["female", "male"]) {
    for (const part of [given, family]) {
      const names = part[sex] ?? part.generic;
      if (!Array.isArray(names) || names.length === 0 || names.some((name) => typeof name !== "string" || !name.trim())) throw new Error(`${locale}: 无效${sex}词库`);
    }
  }
  const content = JSON.stringify({ source: `@faker-js/faker@10.6.0/${englishFallback ? "en" : locale}`, given, family }) + "\n";
  const file = new URL(`${country}.json`, target);
  if (check) {
    if (await readFile(file, "utf8") !== content) throw new Error(`${country}: 请重新生成姓名数据`);
  } else await writeFile(file, content);
}
const require = createRequire(import.meta.url);
const license = await readFile(join(dirname(require.resolve("@faker-js/faker")), "../LICENSE"), "utf8");
const publicLicenseRoot = new URL("../public/licenses/", import.meta.url);
if (!check) await mkdir(publicLicenseRoot, { recursive: true });
for (const licenseTarget of [new URL("LICENSE.faker.txt", target), new URL("faker.txt", publicLicenseRoot)]) {
  if (check) {
    if (await readFile(licenseTarget, "utf8") !== license) throw new Error("姓名数据许可证不一致");
  } else await writeFile(licenseTarget, license);
}
console.log(`11 国姓名数据${check ? "与固定依赖一致" : "已生成"}，MIT 许可证已保留`);
