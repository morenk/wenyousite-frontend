import { expect, test } from "vitest";
import catalog from "../../../../contracts/thread-font-catalog-v1.json";
import type { components } from "@/api/types";
import { textFontGroup, textFontOptions, textFontPreviewSample } from "../editor-text-font-options";

test("选项只消费正式目录的主要设计语言与ready状态，不按名称或汉字推断", () => {
  const fonts = catalog.fonts as components["schemas"]["TextFontFamilyDto"][];
  const options = textFontOptions(fonts);
  expect(options.map(option => option.value)).toEqual(fonts.filter(font => font.availability === "ready").map(font => font.id));
  for (const font of fonts.filter(font => font.availability === "ready")) {
    expect(options.find(option => option.value === font.id)?.group).toBe(textFontGroup(font.designLanguage));
  }
  expect(options.some(option => option.value === "zcoolxiaowei")).toBe(false);
  expect(options.find(option => option.value === "shinsyoku-mincho")?.group).toBe("日文");
  expect(options.find(option => option.value === "xiaocheng-lafeng")?.group).toBe("中文");
});

test.each([undefined, null, "future", "日本語"])("缺失或未知分类 %s 不推断为中文", language => {
  expect(textFontGroup(language)).toBe("未分类");
});

test("日文预览含平片假名，英文预览使用拉丁文字", () => {
  expect(textFontPreviewSample("ja")).toContain("あいうえお アイウエオ");
  expect(textFontPreviewSample("en")).toBe("The quick brown fox Aa 0123");
});
