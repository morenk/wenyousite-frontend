import { describe, expect, test } from "vitest";
import { formatMarkdownPreview } from "@/lib/markdown-preview";

const NODE_ID = "0f16151d-6e9e-415d-b9ae-c91829a52888";

describe("formatMarkdownPreview", () => {
  test("骰子协议只显示方括号包裹的表达式", () => {
    expect(
      formatMarkdownPreview(
        `玛利亚发财概率为：[[dice:v1:${NODE_ID}:2d50]]。`,
      ),
    ).toBe("玛利亚发财概率为：[2d50]。");
  });

  test("Markdown 链接保留文字，隐藏目标地址", () => {
    expect(
      formatMarkdownPreview(
        "查看 [温油站](https://wenyou.site) 或 https://example.com/path。",
      ),
    ).toBe("查看 [温油站] 或 [链接]。");
  });

  test("图片、格式标记和换行转换为紧凑纯文本", () => {
    expect(
      formatMarkdownPreview(
        "## 标题\n\n**重点** ![截图](https://example.com/a.png)",
      ),
    ).toBe("标题 重点 [图片]");
  });

  test("传送门摘要保留自定义名称，裸链接使用默认名称", () => {
    const threadId = "cmsewdo0h000x7qv6aa77ll1v";
    expect(formatMarkdownPreview(
      `[设定 A](/threads/${threadId}) 和 https://wenyou.site/threads/${threadId}`,
    )).toBe("设定 A 和 传送门");
  });
});
