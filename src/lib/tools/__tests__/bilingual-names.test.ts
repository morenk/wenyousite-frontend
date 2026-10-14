import { describe, expect, test } from "vitest";
import fixtures from "../name-fixtures.json";
import dictionary from "../bilingual-name-data.json";
import { COUNTRIES, findSurname, generateBilingualNames, loadNameData, needsSurnameTranslation, type NameOptions } from "../names";
describe("跨端双语姓名契约", () => {
  test.each(fixtures.cases)("$id", async (fixture) => {
    const options = fixture.options as NameOptions;
    const data = await loadNameData(options.country);
    let index = 0;
    const random = () => fixture.randomValues[index++ % fixture.randomValues.length];
    if ("error" in fixture) expect(() => generateBilingualNames(data, options, random)).toThrow(fixture.error);
    else expect(generateBilingualNames(data, options, random)).toEqual(fixture.expected);
    expect(index).toBeLessThanOrEqual(options.count * 40 * 4);
  });
  test("所有国家有完整男女池、中文译名、规定顺序和足够不重复选项", () => {
    expect(Object.keys(dictionary.countries).sort()).toEqual(COUNTRIES.filter((item) => item.id !== "cn").map((item) => item.id).sort());
    for (const [country, data] of Object.entries(dictionary.countries)) {
      const east = ["jp", "kr"].includes(country);
      expect(data.order).toBe(east ? "family-given" : "given-family");
      expect(data.originalSeparator).toBe(east ? "" : " ");
      expect(data.zhSeparator).toBe(east ? "" : "·");
      for (const pool of [...Object.values(data.given), ...Object.values(data.family)]) {
        expect(pool.length).toBeGreaterThanOrEqual(20);
        expect(new Set(pool.map((item) => item.original.toLowerCase())).size).toBe(pool.length);
        for (const item of pool) {
          expect(item.original.trim()).toBe(item.original);
          expect(item.zh).toMatch(/^[\p{Script=Han}]+$/u);
        }
      }
    }
  });
  test("已知姓不使用用户填错的中文，非名录姓只在需要时要求译名", async () => {
    const data = await loadNameData("gb");
    expect(findSurname(data, " SMITH ")).toEqual({ original: "Smith", zh: "史密斯" });
    expect(needsSurnameTranslation(data, "gb", "")).toBe(false);
    expect(needsSurnameTranslation(data, "cn", "Example")).toBe(false);
    expect(generateBilingualNames(data, { country: "gb", sex: "male", style: "common", surname: "Smith", surnameZh: "错", count: 1 }, () => 0))
      .toEqual([{ original: "James Smith", zh: "詹姆斯·史密斯" }]);
    expect(() => generateBilingualNames(data, { country: "gb", sex: "male", style: "common", surname: "X", surnameZh: "字".repeat(41), count: 1 })).toThrow("40");
  });
});
