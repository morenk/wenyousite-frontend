import { describe, expect, it, vi } from "vitest";
import fixtures from "./advanced-name-fixtures.json";
import { advancedNameCountries, chronologicalAdvancedStyles, generateAdvancedNames, loadAdvancedNameData, type AdvancedNameOptions } from "./advanced-names";

const data = await loadAdvancedNameData();
describe("进阶起名 v2 跨端契约", () => {
  for (const fixture of fixtures.cases) it(fixture.id, () => {
    let calls = 0;
    const random = () => fixture.randomValues[calls++ % fixture.randomValues.length];
    const options = fixture.options as AdvancedNameOptions;
    if ("error" in fixture) expect(() => generateAdvancedNames(data, options, random)).toThrow(fixture.error);
    else expect(generateAdvancedNames(data, options, random)).toEqual(fixture.expected);
    expect(calls).toBe(fixture.expectedRandomCalls);
  });
  it("每国风格词池或结构有实际差异，不以标签充数", () => {
    for (const country of advancedNameCountries) for (const mode of ["historical", "literary"]) {
      const styles = data.styles.filter((style) => style.country === country && style.mode === mode);
      expect(styles.length).toBeGreaterThanOrEqual(mode === "literary" ? 3 : 4);
      const signatures = styles.map((style) => JSON.stringify({
        male: style.given.male.map((x) => [x.original, x.zh]),
        female: style.given.female.map((x) => [x.original, x.zh]),
        families: style.families.map((x) => x.forms),
        structures: style.structures.map((x) => [x.originalTemplate, x.zhTemplate]),
      }));
      expect(new Set(signatures).size).toBe(signatures.length);
    }
  });
  it("所有结果无模板残留，第二给名与第一给名不同，外国中译完整", () => {
    for (const style of data.styles) for (const structure of style.structures) for (const sex of ["male", "female"] as const) {
      const [result] = generateAdvancedNames(data, {
        country: style.country, mode: style.mode, styleId: style.id,
        structureId: structure.id, sex, count: 1,
      }, () => 0);
      expect(result.original).not.toMatch(/[{}]/u);
      expect(result.zh).toMatch(/\p{Script=Han}/u);
      if (result.secondGivenId) expect(result.secondGivenId).not.toBe(result.givenId);
      if (result.bynameId) expect(style.bynames![sex].find((x) => x.id === result.bynameId)!.original)
        .not.toBe(style.given[sex].find((x) => x.id === result.givenId)!.original);
    }
  });
  it("同一原文重复时保留第一次的性别与词条元数据", () => {
    const copy = structuredClone(data);
    const style = copy.styles[0];
    style.given.male = [{ ...style.given.female[0], id: "male-same" }];
    style.families = [style.families[0]];
    const randomValues = [0, 0, 0, 0.9, 0, 0];
    let index = 0;
    const result = generateAdvancedNames(copy, {
      country: style.country, mode: style.mode, styleId: style.id,
      structureId: "simple", sex: "any", count: 2,
    }, () => randomValues[index++ % randomValues.length]);
    expect(result).toHaveLength(1);
    expect(result[0].sex).toBe("female");
    expect(result[0].givenId).toBe(style.given.female[0].id);
    expect(index).toBe(2 * 40 * 3);
  });
  it("默认随机源使用本地 Math.random", () => {
    const fixture = fixtures.cases[0];
    const random = vi.spyOn(Math, "random").mockReturnValue(0.9999);
    try { expect(generateAdvancedNames(data, fixture.options as AdvancedNameOptions)).toEqual(fixture.expected); }
    finally { random.mockRestore(); }
  });
});


describe("进阶风格按时间展示", () => {
  it("六国两种类型按起始年和结束年升序，不改源数据", () => {
    const original = JSON.stringify(data);
    for (const country of advancedNameCountries) for (const mode of ["historical", "literary"] as const) {
      const styles = chronologicalAdvancedStyles(data, country, mode);
      expect(styles).toHaveLength(data.styles.filter((item) => item.country === country && item.mode === mode).length);
      const dated = styles.filter((item) => item.period);
      for (let index = 1; index < dated.length; index++) {
        const previous = dated[index - 1].period!;
        const current = dated[index].period!;
        expect(current.from > previous.from || current.from === previous.from && current.to >= previous.to).toBe(true);
      }
    }
    expect(JSON.stringify(data)).toBe(original);
  });
  it("公元前年份数值比较，同期稳定，无日期置后", () => {
    const sample = data.styles[0];
    const styles = [
      { ...sample, id: "undated-a", period: undefined },
      { ...sample, id: "long", period: { from: -200, to: 100 } },
      { ...sample, id: "early", period: { from: -500, to: -300 } },
      { ...sample, id: "short-a", period: { from: -200, to: -100 } },
      { ...sample, id: "short-b", period: { from: -200, to: -100 } },
      { ...sample, id: "undated-b", period: undefined },
    ];
    expect(chronologicalAdvancedStyles({ ...data, styles }, sample.country, sample.mode).map((item) => item.id))
      .toEqual(["early", "short-a", "short-b", "long", "undated-a", "undated-b"]);
  });
});
