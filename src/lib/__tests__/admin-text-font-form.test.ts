import { expect, test } from "vitest";
import {
  emptyTextFontConfiguration,
  textFontConfigurationSchema,
  textFontUploadError,
  textFontWithdrawSchema,
} from "../admin-text-font-form";
test("草稿允许缺授权；Unicode长度按码点且样张禁止控制字符", () => {
  expect(
    textFontConfigurationSchema.safeParse({ ...emptyTextFontConfiguration, name: "草稿" }).success,
  ).toBe(true);
  expect(
    textFontConfigurationSchema.safeParse({
      ...emptyTextFontConfiguration,
      name: "𠀀".repeat(80),
    }).success,
  ).toBe(true);
  expect(
    textFontConfigurationSchema.safeParse({
      ...emptyTextFontConfiguration,
      name: "𠀀".repeat(81),
    }).success,
  ).toBe(false);
  for (const specimenText of ["", " ", "A\nB", "A\rB", "A\tB", "\0", "A\u200bB", "A\u0085B"]) {
    expect(
      textFontConfigurationSchema.safeParse({
        ...emptyTextFontConfiguration,
        name: "字体",
        specimenText,
      }).success,
    ).toBe(false);
  }
  for (const sortOrder of [1.5, -1000001, 1000001])
    expect(
      textFontConfigurationSchema.safeParse({
        ...emptyTextFontConfiguration,
        sortOrder,
      }).success,
    ).toBe(false);
});
test("仅接受不超过64MiB的非空单个TTF/OTF", () => {
  expect(textFontUploadError(undefined)).toBeDefined();
  for (const name of [
    "file.zip",
    "file.ttc",
    "file.otf.zip",
    "https://x/font",
  ]) {
    expect(textFontUploadError({ name, size: 10 })).toBeDefined();
  }
  for (const name of ["file.ttf", "file.OTF"]) {
    expect(textFontUploadError({ name, size: 67108864 })).toBeUndefined();
    expect(textFontUploadError({ name, size: 67108865 })).toBeDefined();
    expect(textFontUploadError({ name, size: 0 })).toBeDefined();
  }
});
test("撤回要求非空理由，保留实际文字而不是静默截断", () => {
  for (const reason of ["", "   ", "x".repeat(501)])
    expect(textFontWithdrawSchema.safeParse({ reason }).success).toBe(false);
  expect(textFontWithdrawSchema.parse({ reason: " 错误授权 " }).reason).toBe(
    " 错误授权 ",
  );
});

test("名称和样张必填，来源可暂缺但填写后必须是 HTTP(S) URL", () => {
  for (const name of ["", "  "]) expect(textFontConfigurationSchema.safeParse({ ...emptyTextFontConfiguration, name }).success).toBe(false);
  for (const sourceUrl of ["", "https://example.org/font"]) expect(textFontConfigurationSchema.safeParse({ ...emptyTextFontConfiguration, name: "字体", sourceUrl }).success).toBe(true);
  for (const sourceUrl of ["example.org", "javascript:alert(1)", "ftp://example.org/font"]) expect(textFontConfigurationSchema.safeParse({ ...emptyTextFontConfiguration, name: "字体", sourceUrl }).success).toBe(false);
});
