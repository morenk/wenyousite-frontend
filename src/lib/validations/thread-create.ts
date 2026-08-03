/** 主题帖创建/编辑表单校验 schema */

import { z } from "zod";
import { hasVisibleMarkdownContent } from "@/lib/markdown";

export const threadCreateSchema = z.object({
  title: z
    .string()
    .max(100, "标题最多 100 个字符")
    .optional(),
  category: z.enum(["DEDUCTION", "NATION", "RPG"], {
    message: "请选择分区",
  }),
  visibility: z.enum(["PUBLIC", "PRIVATE"], {
    message: "请选择可见性",
  }),
  tagNames: z
    .array(z.string().min(1).max(20))
    .max(5, "最多 5 个标签")
    .optional(),
  subthreadTitle: z
    .string()
    .min(1, "请输入子贴标题")
    .max(100, "子贴标题最多 100 个字符")
    .optional(),
  content: z
    .string()
    .max(10000, "正文最多 10000 个字符")
    .optional(),
});

export type ThreadCreateFormData = z.infer<typeof threadCreateSchema>;

export function validatePublishable(
  values: ThreadCreateFormData,
  defaultContent?: string,
): string | null {
  if (!values.title || values.title.trim() === "") {
    return "请填写主题帖标题后再发布";
  }
  if (values.title.trim() === "未命名草稿") {
    return "请填写主题帖标题后再发布";
  }
  if (!values.category) {
    return "请选择分区后再发布";
  }
  const effectiveContent = defaultContent ?? values.content ?? "";
  if (!hasVisibleMarkdownContent(effectiveContent)) {
    return "请为默认子贴填写正文后再发布";
  }
  return null;
}
