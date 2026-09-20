import { describe, expect, it } from "vitest";
import { adminAttachedMedia, adminBeijingDate, adminThreadTaxonomySchema } from "./admin-content-management";

describe("内容管理输入", () => {
  it("动态正文中的附件URL不隐藏图片，仅对真实Markdown图片节点去重", () => {
    const media = [{ url: "https://example.test/media/image.png" }];
    expect(adminAttachedMedia("moment", media[0].url, media)).toEqual(media);
    expect(adminAttachedMedia("moment_comment", media[0].url, media)).toEqual(media);
    expect(adminAttachedMedia("thread", media[0].url, media)).toEqual(media);
    expect(adminAttachedMedia("thread", "![说明](" + media[0].url + ")", media)).toEqual([]);
    expect(adminAttachedMedia("post", "`![说明](" + media[0].url + ")`", media)).toEqual(media);
  });
  it("日期按北京时间边界查询", () => {
    expect(adminBeijingDate("2026-09-20")).toBe("2026-09-19T16:00:00.000Z");
    expect(adminBeijingDate("2026-09-20", true)).toBe("2026-09-20T15:59:59.999Z");
    expect(adminBeijingDate("bad")).toBeUndefined();
  });
  it("分类不可清空，理由必填，标签允许清空且最多五个", () => {
    const valid = { category: "RPG", tagIds: [], reason: "整理分类" };
    expect(adminThreadTaxonomySchema.safeParse(valid).success).toBe(true);
    expect(adminThreadTaxonomySchema.safeParse({ ...valid, category: "" }).success).toBe(false);
    expect(adminThreadTaxonomySchema.safeParse({ ...valid, reason: " " }).success).toBe(false);
    expect(adminThreadTaxonomySchema.safeParse({ ...valid, tagIds: ["1", "2", "3", "4", "5", "6"] }).success).toBe(false);
  });
});
