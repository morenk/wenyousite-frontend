import { describe, expect, test } from "vitest";
import { COUNTRIES, formatName, generateNames, loadNameData, type NameData, type NameOptions } from "../names";
const defaults: NameOptions = { country: "cn", sex: "any", style: "common", surname: "", count: 5 };
const sample: NameData = { source: "test", given: { male: ["男"], female: ["女"] }, family: { male: ["男姓"], female: ["女姓"] } };
describe("多国姓名", () => {
  test.each(COUNTRIES)("$label 使用原文词库且男女来源有效", async ({ id }) => {
    const data = await loadNameData(id);
    expect(data.source).toMatch(/@faker-js\/faker@10\.6\.0/);
    for (const sex of ["male", "female"] as const) {
      const names = generateNames(data, { ...defaults, country: id, sex, count: 3 });
      expect(names).toHaveLength(3);
      const fixed = generateNames(data, { ...defaults, country: id, sex, surname: "固定姓", count: 2 });
      expect(fixed.every((name) => ["cn", "jp", "kr"].includes(id) ? name.startsWith("固定姓") : name.endsWith(" 固定姓"))).toBe(true);
    }
  });
  test("共用英语来源明确；姓氏与名字使用同一性别", async () => {
    expect((await loadNameData("gb")).source).toBe("@faker-js/faker@10.6.0/en");
    expect((await loadNameData("us")).source).toBe("@faker-js/faker@10.6.0/en");
    expect(generateNames(sample, defaults, () => 0)).toEqual(["女姓女"]);
    expect(generateNames(sample, defaults, () => 0.9)).toEqual(["男姓男"]);
    expect(generateNames(sample, { ...defaults, sex: "female", surname: "  王  " }, () => 0)).toEqual(["王女"]);
  });
  test("中日韩姓在前，其他简式名在前", () => {
    expect(formatName("jp", "太郎", "山田")).toBe("山田太郎");
    expect(formatName("kr", "민준", "김")).toBe("김민준");
    expect(formatName("fr", "Émile", "Martin")).toBe("Émile Martin");
  });
  test("自编风格、去重上限和参数验证", () => {
    expect(generateNames(sample, { ...defaults, style: "classical", sex: "female" }, () => 0)).toEqual(["女姓知棠"]);
    expect(generateNames(sample, { ...defaults, style: "fantasy", sex: "male" }, () => 0)).toEqual(["男姓星珩"]);
    for (const count of [0, 51, 1.5, NaN]) expect(() => generateNames(sample, { ...defaults, count })).toThrow();
    for (const surname of ["字".repeat(41), "甲\n乙", "甲\t乙"]) expect(() => generateNames(sample, { ...defaults, surname })).toThrow();
    expect(() => generateNames(sample, { ...defaults, country: "jp", style: "fantasy" })).toThrow("中文");
  });
});
