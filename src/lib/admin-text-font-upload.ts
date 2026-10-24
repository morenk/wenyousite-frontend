import { z } from "zod";
import type { components } from "@/api/types";
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

const fontFailureReasons = {
  "embedding-restricted": "字体禁止嵌入",
  "subsetting-restricted": "字体禁止分片",
  "bitmap-only": "字体仅允许位图嵌入",
} as const;

const fontFailureCodes = {
  "invalid-font": "字体文件无效",
  "unsupported-font": "不支持此字体格式",
  "rights-required": "授权材料或权限不完整",
  "resource-limit": "超出处理资源限制",
  "sandbox-unavailable": "处理环境暂不可用",
  "processing-failed": "字体处理失败",
} as const;

/** 仅展示契约类别对应的固定文案，不回显服务端诊断内容。 */
export function fontJobFailureMessage(job: Pick<components["schemas"]["FontJobDto"], "failureCode" | "failureReason">) {
  if (job.failureReason && Object.hasOwn(fontFailureReasons, job.failureReason)) return fontFailureReasons[job.failureReason];
  if (job.failureCode && Object.hasOwn(fontFailureCodes, job.failureCode)) return fontFailureCodes[job.failureCode];
  return undefined;
}
