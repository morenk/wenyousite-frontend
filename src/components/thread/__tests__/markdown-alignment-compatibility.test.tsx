import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, test } from "vitest";
import { MarkdownContent } from "@/components/thread/markdown-content";

const CENTER_MARKER = "[wenyousite-align-v1-center]: #";
const RIGHT_MARKER = "[wenyousite-align-v1-right]: #";
const DICE_NODE_ID = "550e8400-e29b-41d4-a716-446655440000";
const DICE_MARKER = `[[dice:v1:${DICE_NODE_ID}:1d20]]`;
const STICKER = [
  "![表情](https://cdn.example.com/stickers/a.webp",
  '"wenyousite-sticker:v1:cm1234567890123456789012")',
].join(" ");

afterEach(cleanup);

function markdownRoot(): HTMLElement {
  return document.querySelector<HTMLElement>('[data-slot="markdown-content"]')!;
}

function blockWithText(text: string): HTMLElement {
  const block = Array.from(markdownRoot().querySelectorAll<HTMLElement>("p, h2, h3"))
    .find((candidate) => candidate.textContent?.includes(text));
  expect(block).toBeDefined();
  return block!;
}

describe("MarkdownContent 段落对齐兼容性", () => {
  test("相邻左中右块各自保留对齐，且不会把属性泄漏给行内样式或后续块", () => {
    render(
      <MarkdownContent
        content={[
          "左侧 **粗体**",
          "",
          CENTER_MARKER,
          "居中 *斜体* ~~删除~~ `code` [外链](https://example.com)",
          "",
          RIGHT_MARKER,
          "## 居右 **标题** [@南枝](/users/user-1)",
          "",
          "尾段",
        ].join("\n")}
      />,
    );

    const left = blockWithText("左侧");
    const center = blockWithText("居中");
    const right = blockWithText("居右");
    const trailing = blockWithText("尾段");

    expect(left).not.toHaveAttribute("data-wenyou-align");
    expect(center).toHaveAttribute("data-wenyou-align", "center");
    expect(right).toHaveAttribute("data-wenyou-align", "right");
    expect(trailing).not.toHaveAttribute("data-wenyou-align");
    expect(center).toContainElement(center.querySelector("em"));
    expect(center).toContainElement(center.querySelector("del"));
    expect(center).toContainElement(center.querySelector("code"));
    expect(right.querySelector('[data-slot="mention-link"]')).toHaveTextContent("@南枝");
    expect(markdownRoot().querySelectorAll('[data-wenyou-align] [data-wenyou-align]'))
      .toHaveLength(0);
  });

  test.each([
    ["粗体", "**粗体**", "strong"],
    ["斜体", "*斜体*", "em"],
    ["粗斜体", "***粗斜体***", "em > strong"],
    ["删除线", "~~删除线~~", "del"],
    ["行内代码", "`const value = 1`", "code"],
    ["普通链接", "[帮助](https://example.com/help)", 'a[href="https://example.com/help"]'],
    ["站内传送门", "[设定](/threads/cmsewdo0h000x7qv6aa77ll1v)", '[data-slot="internal-reference-link"]'],
    ["用户提及", "[@南枝](/users/user-1)", '[data-slot="mention-link"]'],
    ["骰子", DICE_MARKER, `[data-dice-node-id="${DICE_NODE_ID}"]`],
    ["收藏表情", STICKER, 'img[alt="表情"]'],
  ])("居中块兼容%s，不改变其行内语义", (_label, source, selector) => {
    render(<MarkdownContent content={`${CENTER_MARKER}\n${source}`} />);

    const block = markdownRoot().querySelector<HTMLElement>(":scope > p")!;
    expect(block).toHaveAttribute("data-wenyou-align", "center");
    expect(block.querySelector(selector)).not.toBeNull();
    expect(block.querySelector(selector)?.closest('[data-wenyou-align]')).toBe(block);
  });

  test("同一居右块可组合全部行内工具、软换行和原子节点", () => {
    render(
      <MarkdownContent
        content={[
          RIGHT_MARKER,
          `中文Latin🙂 **粗体** *斜体* ~~删除~~ \`code\` [链接](https://example.com) [@南枝](/users/user-1) ${DICE_MARKER} ${STICKER}`,
          "第二行仍在同一块",
        ].join("\n")}
      />,
    );

    const paragraph = markdownRoot().querySelector<HTMLElement>(":scope > p")!;
    expect(paragraph).toHaveAttribute("data-wenyou-align", "right");
    for (const selector of [
      "strong",
      "em",
      "del",
      "code",
      'a[href="https://example.com"]',
      '[data-slot="mention-link"]',
      `[data-dice-node-id="${DICE_NODE_ID}"]`,
      'img[alt="表情"]',
    ]) {
      expect(paragraph.querySelector(selector), selector).not.toBeNull();
    }
    expect(paragraph.querySelectorAll("br")).toHaveLength(1);
    expect(paragraph).toHaveTextContent("第二行仍在同一块");
  });

  test.each([
    ["无序列表", "- 列表项目"],
    ["有序列表", "1. 列表项目"],
    ["引用", "> 引用内容"],
    ["分隔线", "---"],
    ["协议空段", "<br />"],
    ["一级标题", "# 一级标题"],
    ["四级标题", "#### 四级标题"],
  ])("%s 前的对齐标记降为字面内容，并且不污染后续合法段落", (_label, target) => {
    render(
      <MarkdownContent
        content={[CENTER_MARKER, target, "", "后续正文"].join("\n")}
      />,
    );

    expect(markdownRoot().querySelector("[data-wenyou-align]")).toBeNull();
    expect(blockWithText("后续正文")).not.toHaveAttribute("data-wenyou-align");
  });

  test("v4 客户端仍将普通图片前的对齐标记降为字面内容", () => {
    render(
      <MarkdownContent
        markdownContractVersion={4}
        content={[CENTER_MARKER, "![普通图片](https://cdn.example.com/a.png)", "", "后续正文"].join("\n")}
      />,
    );

    expect(markdownRoot().querySelector("[data-wenyou-align]")).toBeNull();
    expect(blockWithText("后续正文")).not.toHaveAttribute("data-wenyou-align");
  });

  test("原始 HTML、style、align 属性和协议字面代码都不能伪造对齐", () => {
    render(
      <MarkdownContent
        content={[
          '<p data-wenyou-align="right" align="center" style="text-align:right">伪造</p>',
          "",
          "`[wenyousite-align-v1-center]: #` 是协议示例",
        ].join("\n")}
      />,
    );

    expect(markdownRoot()).toHaveTextContent("伪造");
    expect(markdownRoot()).toHaveTextContent("wenyousite-align-v1-center");
    expect(markdownRoot().querySelector("[data-wenyou-align], [align], [style]"))
      .toBeNull();
    expect(markdownRoot().querySelector("code")).toHaveTextContent(
      "[wenyousite-align-v1-center]: #",
    );
  });

  test.each(["reading", "compact"] as const)(
    "%s 阅读密度使用同一对齐 DOM 契约",
    (size) => {
      render(
        <MarkdownContent
          size={size}
          content={`${RIGHT_MARKER}\n### 多语言 CJK Latin العربية 🙂`}
        />,
      );

      const root = markdownRoot();
      expect(root).toHaveAttribute("data-size", size);
      expect(root.querySelector(":scope > h3")).toHaveAttribute(
        "data-wenyou-align",
        "right",
      );
    },
  );
});
