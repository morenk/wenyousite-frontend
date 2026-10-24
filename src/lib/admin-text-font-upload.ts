import { z } from "zod";
import { textFontUploadError } from "./admin-text-font-form";

export const fontLanguageLabels = { zh: "中文", ja: "日文", en: "英文", other: "未分类" } as const;
export type FontLanguage = keyof typeof fontLanguageLabels;

/** 上传表单值；接口编排在已提交契约接入后由上层负责。 */
export const adminTextFontUploadSchema = z.object({
  file: z.custom<File>((value) => typeof File !== "undefined" && value instanceof File, "请选择字体文件")
    .superRefine((file, context) => {
      const error = textFontUploadError(file);
      if (error) context.addIssue({ code: "custom", message: error });
    }),
  name: z.string().trim().min(1, "请填写字体名称").refine((value) => Array.from(value).length <= 80, "最多 80 个字符"),
  language: z.enum(["zh", "ja", "en", "other"]),
});
export type AdminTextFontUploadValues = z.infer<typeof adminTextFontUploadSchema>;
export function fontNameFromFile(name: string) {
  return Array.from(name.replace(/\.(ttf|otf)$/iu, "").trim()).slice(0, 80).join("");
}

export const fontFailureReasons = {
  "embedding-restricted": "字体禁止嵌入",
  "subsetting-restricted": "字体禁止分片",
  "bitmap-only": "字体仅允许位图嵌入",
} as const;
