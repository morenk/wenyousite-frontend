import { readFileSync } from "node:fs";
import { expect, test } from "vitest";
import { assessEditorCompatibility, assessEditorInput } from "../editor-content-compatibility";
const fixtures = JSON.parse(readFileSync("contracts/rich-text-behavior-v1-fixtures.json", "utf8")) as {
  compatibilityCases: Array<{ id: string; markdown: string; profile: string; lossless: boolean; expected: unknown }>;
};
test.each(fixtures.compatibilityCases)("$id 按共享能力矩阵分别判断读建改", (item) => {
  expect(assessEditorCompatibility(item.markdown, item.profile, item.lossless)).toEqual(item.expected);
});
test.each([0, 1, 2, 6, 99])("未知服务端版本 %s 保留阅读但不开放正文写入", (version) => {
  expect(assessEditorInput("甲", version)).toEqual({ read: "safe-fallback", create: false, edit: false, reason: "unknown-profile" });
});
test.each([3, 4, 5])("当前 Web 对服务端 %s 保留已有引用空行读取能力", (version) => {
  expect(assessEditorInput("> 甲\n> <br />\n> 乙", version).edit).toBe(true);
});


test("CRLF 对齐标记同样受旧服务端写能力保护", () => {
  expect(assessEditorInput("[wenyousite-align-v1-center]: #\r\n甲", 3).edit).toBe(false);
  expect(assessEditorCompatibility("甲", "toString").edit).toBe(false);
});
