import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, test } from "vitest";
import { MarkdownContent } from "@/components/thread/markdown-content";
import { findUnsupportedMarkdownFormats } from "@/lib/markdown";
import { formatMarkdownPreview } from "@/lib/markdown-preview";
import { createReaderClipboardPayload } from "@/lib/site-clipboard";

afterEach(cleanup);

const targets = [
  { kind: "P", source: "目标正文", selector: "p", text: "目标正文" },
  { kind: "H2", source: "## 目标标题", selector: "h2", text: "目标标题" },
  { kind: "H3", source: "### 目标标题", selector: "h3", text: "目标标题" },
  { kind: "image", source: "![目标图片](https://example.com/boundary.png)", selector: "img", text: "[图片]" },
] as const;
const cases = (["center", "right"] as const).flatMap((alignment) =>
  targets.flatMap((target) => (["\n", "\r\n"] as const).map((newline) => ({
    ...target, alignment, newlineName: newline === "\n" ? "LF" : "CRLF",
    markdown: ["经历：", `[wenyousite-align-v1-${alignment}]: #`, target.source, "", "后文"].join(newline),
  }))),
);

describe("顶层 marker 前无空行的真实阅读边界", () => {
  test.each(cases)("$alignment $kind $newlineName 校验不误判", ({ markdown }) => {
    expect(findUnsupportedMarkdownFormats(markdown)).toEqual([]);
  });

  test.each(cases)("$alignment $kind $newlineName DOM 与复制不泄漏协议或增加空行", (item) => {
    const { container } = render(<MarkdownContent content={item.markdown} />);
    const root = container.querySelector<HTMLElement>('[data-slot="markdown-content"]')!;
    const aligned = root.querySelector<HTMLElement>(`[data-wenyou-align="${item.alignment}"]`);
    expect(root.querySelectorAll("[data-wenyou-align]")).toHaveLength(1);
    expect(aligned).not.toBeNull();
    if (item.kind === "image") expect(aligned!.querySelector("img")).not.toBeNull();
    else {
      expect(aligned!.tagName.toLowerCase()).toBe(item.selector);
      expect(aligned!.textContent).toBe(item.text);
    }
    expect(root.querySelector("p")!.textContent).toBe("经历：");
    expect(root.textContent).not.toContain("wenyousite-align");
    expect(root.querySelectorAll("br")).toHaveLength(0);
    const payload = createReaderClipboardPayload(root);
    expect(payload.text).toBe(`经历：\n\n${item.text}\n\n后文`);
    expect(payload.html).not.toContain("wenyousite-align-v1");
  });

  test.each(cases)("$alignment $kind $newlineName 已有空行的阅读与复制对照", (item) => {
    const { container } = render(<MarkdownContent content={item.markdown.replace(/经历：\r?\n/u, "经历：\n\n")} />);
    const root = container.querySelector<HTMLElement>('[data-slot="markdown-content"]')!;
    expect(root.querySelectorAll("[data-wenyou-align]")).toHaveLength(1);
    expect(root.querySelectorAll("br")).toHaveLength(0);
    expect(createReaderClipboardPayload(root).text).toBe(`经历：\n\n${item.text}\n\n后文`);
  });

  test("连续对齐块各自终止前段，保留文字与两个独立属性", () => {
    const { container } = render(<MarkdownContent content={[
      "经历：", "[wenyousite-align-v1-center]: #", "居中正文",
      "[wenyousite-align-v1-right]: #", "居右正文",
    ].join("\n")} />);
    const blocks = Array.from(container.querySelectorAll("p"));
    expect(blocks.map((block) => [block.textContent, block.getAttribute("data-wenyou-align")]))
      .toEqual([["经历：", null], ["居中正文", "center"], ["居右正文", "right"]]);
    expect(container.querySelectorAll("br")).toHaveLength(0);
  });

  test.each(cases)("$alignment $kind $newlineName 摘要隐藏有效 marker", (item) => {
    expect(formatMarkdownPreview(item.markdown)).toBe(`经历： ${item.text} 后文`);
  });
});
