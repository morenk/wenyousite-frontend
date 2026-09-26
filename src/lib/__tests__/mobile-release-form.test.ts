import { describe, expect, it } from "vitest";
import { mobileReleaseFormSchema, releaseNotesLines } from "../mobile-release-form";

const valid = { versionName: "0.8.0-dev.1", buildNumber: 97, summary: "改进阅读", itemsText: "优化滚动\n修复显示" };
describe("移动版本说明表单契约", () => {
  it("允许精确版本身份与纯文本，不将标记转换成富文本", () => {
    expect(mobileReleaseFormSchema.parse({ ...valid, summary: " **摘要** " }).summary).toBe("**摘要**");
    expect(releaseNotesLines("\n <b>第一条</b> \r\n[第二条](url)\r")).toEqual(["<b>第一条</b>", "[第二条](url)"]);
  });
  it.each([
    { versionName: "" }, { versionName: "bad version" }, { versionName: "-1" }, { versionName: "x".repeat(65) },
    { buildNumber: NaN }, { buildNumber: 0 }, { buildNumber: 1.5 }, { buildNumber: 2100000001 },
    { summary: " \n " }, { summary: "😀".repeat(201) },
    { itemsText: "\n\r " }, { itemsText: Array(31).fill("条目").join("\n") }, { itemsText: "😀".repeat(501) },
  ])("拒绝无效字段 %j", (patch) => {
    expect(mobileReleaseFormSchema.safeParse({ ...valid, ...patch }).success).toBe(false);
  });
  it("Unicode 码点与上限匹配后端", () => {
    expect(mobileReleaseFormSchema.safeParse({ versionName: "x".repeat(64), buildNumber: 2100000000, summary: "😀".repeat(200), itemsText: Array(30).fill("😀".repeat(500)).join("\n") }).success).toBe(true);
  });
});
