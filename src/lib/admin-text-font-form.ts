import { z } from "zod";
const text = (max: number) =>
  z
    .string()
    .refine((value) => Array.from(value).length <= max, `最多 ${max} 个字符`);
export const textFontConfigurationSchema = z.object({
  name: text(80).refine((value) => value.trim().length > 0, "请填写字体名称"),
  designLanguage: z.enum(["zh", "ja", "en", "other"]),
  sortOrder: z.number().int().min(-1000000).max(1000000),
  author: text(200),
  sourceUrl: text(2048).refine((value) => value === "" || z.url({ protocol: /^https?$/ }).safeParse(value).success, "请输入完整的 HTTP 或 HTTPS 来源链接"),
  licenseName: text(200),
  licenseText: text(65536),
  specimenText: text(200).refine((value) => value.trim().length > 0, "请填写样张文字").refine(
    (value) => !/[\p{Cc}\p{Cf}]/u.test(value),
    "样张文字不能包含换行或控制字符",
  ),
  rights: z.object({
    redistribution: z.boolean(),
    conversion: z.boolean(),
    subsetting: z.boolean(),
  }),
});
export const textFontMetadataSchema = textFontConfigurationSchema.extend({
  specimenText: text(200).refine((value) => !/[\p{Cc}\p{Cf}]/u.test(value), "样张文字不能包含换行或控制字符"),
});
export type TextFontConfigurationValues = z.infer<
  typeof textFontConfigurationSchema
>;
export const emptyTextFontConfiguration: TextFontConfigurationValues = {
  name: "",
  designLanguage: "zh",
  sortOrder: 0,
  author: "",
  sourceUrl: "",
  licenseName: "",
  licenseText: "",
  specimenText: "春风又绿江南岸 Aa 0123",
  rights: { redistribution: false, conversion: false, subsetting: false },
};
export function textFontUploadError(
  file: Pick<File, "name" | "size"> | undefined,
): string | undefined {
  if (!file) return "请选择字体文件";
  if (!/\.(ttf|otf)$/iu.test(file.name)) return "仅支持单个 TTF 或 OTF 文件";
  if (file.size < 1) return "字体文件不能为空";
  if (file.size > 67108864) return "字体文件不能超过 64 MiB";
}
export const textFontWithdrawSchema = z.object({
  reason: text(500).refine(
    (value) => value.trim().length > 0,
    "请填写撤回理由",
  ),
});
