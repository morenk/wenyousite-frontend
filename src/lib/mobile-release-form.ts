import { z } from "zod";

export function releaseNotesLines(text: string): string[] {
  return text.split(/\r\n|\r|\n/).map((line) => line.trim()).filter(Boolean);
}

/** 与 Backend 5.27.0-dev.20260927.1 的 Create/Update DTO 保持一致，按 Unicode 码点计数。 */
export const mobileReleaseFormSchema = z.object({
  versionName: z.string().trim().regex(/^[0-9A-Za-z][0-9A-Za-z._-]{0,63}$/, "版本名须为 1–64 位字母、数字、点、下划线或连字符，并以字母或数字开头"),
  buildNumber: z.number({ error: "请输入构建号" }).int("构建号必须是整数").min(1, "构建号至少为 1").max(2100000000, "构建号不能超过 2100000000"),
  summary: z.string().trim().min(1, "请输入更新摘要").refine((value) => Array.from(value).length <= 200, "摘要最多 200 个字符"),
  itemsText: z.string().superRefine((value, ctx) => {
    const lines = releaseNotesLines(value);
    if (lines.length === 0 || lines.length > 30) ctx.addIssue({ code: "custom", message: "请填写 1–30 条更新内容，一行一项" });
    const tooLong = lines.findIndex((line) => Array.from(line).length > 500);
    if (tooLong !== -1) ctx.addIssue({ code: "custom", message: `第 ${tooLong + 1} 条超过 500 个字符` });
  }),
});

export type MobileReleaseFormValues = z.infer<typeof mobileReleaseFormSchema>;
