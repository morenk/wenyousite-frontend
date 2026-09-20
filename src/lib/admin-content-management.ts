import { analyzeMarkdownBlockBoundaries } from "@/lib/markdown-block-boundaries";
import { prepareMarkdownForReader } from "@/lib/markdown";
import { z } from "zod";
import type { AdminContentType } from "@/api/admin-types";

export const adminContentLabels: Record<AdminContentType, string> = {
  thread: "主题帖", post: "楼层与回复", moment: "动态", moment_comment: "动态评论",
};

export function adminBeijingDate(value: string, end = false) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
  const date = new Date(value + (end ? "T23:59:59.999+08:00" : "T00:00:00+08:00"));
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

export const adminThreadTaxonomySchema = z.object({
  category: z.string().min(1, "请选择分类"),
  tagIds: z.array(z.string()).max(5, "最多选择 5 个标签"),
  reason: z.string().trim().min(1, "请填写理由").max(500, "理由最多 500 个字"),
});


export function adminAttachedMedia<T extends { url: string }>(type: AdminContentType, content: string, media: T[]): T[] {
  if (type === "moment" || type === "moment_comment") return media;
  const { tokens } = analyzeMarkdownBlockBoundaries(prepareMarkdownForReader(content));
  const embedded = new Set(tokens.flatMap((token) =>
    (token.children ?? []).filter((child) => child.type === "image").map((child) => child.attrGet("src"))));
  return media.filter((item) => !embedded.has(item.url));
}
