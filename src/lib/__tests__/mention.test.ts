/** 编辑器提及协议测试：稳定路径识别与 DOM 原子标记 */

import { describe, expect, test } from "vitest";
import {
  getMentionUserId,
  markEditorMentionAnchors,
} from "@/lib/mention";

describe("getMentionUserId", () => {
  test("只识别精确用户路径与 @ 标签", () => {
    expect(getMentionUserId("/users/u_2-abc", "@张三")).toBe("u_2-abc");
    expect(getMentionUserId("/users/u2/followers", "@张三")).toBeNull();
    expect(getMentionUserId("/users/u2", "用户主页")).toBeNull();
    expect(getMentionUserId("https://wenyou.site/users/u2", "@张三")).toBeNull();
  });
});

describe("markEditorMentionAnchors", () => {
  test("把稳定提及链接标记为不可编辑原子内容", () => {
    const root = document.createElement("div");
    root.innerHTML = [
      '<a href="/users/u2">@张三</a>',
      '<a href="/users/u3">用户主页</a>',
      '<a href="/users/u4/followers">@李四</a>',
    ].join("");

    expect(markEditorMentionAnchors(root)).toBe(1);
    const mention = root.querySelector<HTMLAnchorElement>('a[href="/users/u2"]');
    expect(mention).toHaveAttribute("contenteditable", "false");
    expect(mention).toHaveAttribute("spellcheck", "false");
    expect(mention).toHaveAttribute("data-mention-id", "u2");
    expect(root.querySelector('a[href="/users/u3"]')).not.toHaveAttribute(
      "data-mention-id",
    );
    expect(root.querySelector('a[href="/users/u4/followers"]')).not.toHaveAttribute(
      "data-mention-id",
    );

    mention!.textContent = "用户主页";
    expect(markEditorMentionAnchors(root)).toBe(0);
    expect(mention).not.toHaveAttribute("contenteditable");
    expect(mention).not.toHaveAttribute("data-mention-id");
  });
});
