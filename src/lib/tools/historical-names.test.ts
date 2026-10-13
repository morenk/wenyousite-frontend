import { describe, expect, it, vi } from "vitest";
import fixtureData from "./historical-name-fixtures.json";
import { generateHistoricalNames, loadHistoricalNameData, type HistoricalNameOptions } from "./historical-names";
const data = await loadHistoricalNameData();
describe("历史姓名跨端契约", () => {
  for (const fixture of fixtureData.cases) it(fixture.id, () => {
    let index = 0;
    const random = () => fixture.randomValues[index++ % fixture.randomValues.length];
    const options = fixture.options as HistoricalNameOptions;
    if ("error" in fixture) expect(() => generateHistoricalNames(data, options, random)).toThrow(fixture.error);
    else expect(generateHistoricalNames(data, options, random)).toEqual(fixture.expected);
  });
  it("所有时代/家族与双性别组合有完整双语且不生成爵位", () => {
    for (const profile of data.profiles) for (const role of profile.roles) for (const familyId of role.familyIds) for (const sex of ["male", "female"] as const) {
      const [result] = generateHistoricalNames(data, { country: profile.country, profileId: profile.id, role: role.id, familyId, sex, count: 1, includePatronymic: !!profile.patronymics }, () => 0);
      expect(result.original).toBeTruthy();
      expect(result.zh).toMatch(/\p{Script=Han}/u);
      expect(result.familyId).toBe(familyId);
      expect(result.sex).toBe(sex);
    }
  });
  it("固定家族不消耗随机抽样，首个随机值选择名字", () => {
    const profile = data.profiles[0];
    const random = vi.fn(() => 0.9999);
    const [result] = generateHistoricalNames(data, { country: profile.country, profileId: profile.id, role: "period", familyId: profile.families[0].id, sex: "male", count: 1, includePatronymic: false }, random);
    expect(random).toHaveBeenCalledTimes(1);
    expect(result.givenId).toBe(profile.given.male.at(-1)!.id);
  });
  it("未注入随机源时使用本地 Math.random", () => {
    const spy = vi.spyOn(Math, "random").mockReturnValue(0);
    try {
      const fixture = fixtureData.cases[0];
      expect(generateHistoricalNames(data, fixture.options as HistoricalNameOptions)).toEqual(fixture.expected);
    } finally { spy.mockRestore(); }
  });
});
