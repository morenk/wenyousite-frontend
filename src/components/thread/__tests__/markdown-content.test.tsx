/** MarkdownContent 组件测试：图片约束尺寸、中图替换、lightbox 交互 */

import { describe, test, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup, fireEvent, within, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MarkdownContent } from "@/components/thread/markdown-content";

afterEach(() => cleanup());

const UPLOADED_URL =
  "https://cos.example.com/wenyou/uploads/2026/01/01/u1/123-abc.jpg";
const UPLOADED_MD_URL = UPLOADED_URL.replace(/\.jpg$/, "_md.webp");
const EXTERNAL_URL = "https://example.com/pic.png";
const DICE_NODE_ID = "550e8400-e29b-41d4-a716-446655440000";
const DICE_MARKER = `[[dice:v1:${DICE_NODE_ID}:1d20]]`;

describe("MarkdownContent", () => {
  test("渲染普通 markdown 文本", () => {
    render(<MarkdownContent content={"# 标题\n\n正文内容"} />);
    expect(screen.getByRole("heading", { name: "标题" })).toBeInTheDocument();
    expect(screen.getByText("正文内容")).toBeInTheDocument();
    expect(document.querySelector('[data-slot="markdown-content"]')).toHaveClass(
      "wenyou-prose",
    );
    expect(document.querySelector('[data-slot="markdown-content"]')).not.toHaveClass(
      "prose-sm",
      "prose-headings:font-display",
    );
  });

  test("嵌套回复使用稍紧凑但不缩小到小号正文的排版", () => {
    render(<MarkdownContent content="回复正文" size="compact" />);
    const content = document.querySelector('[data-slot="markdown-content"]');
    expect(content).toHaveAttribute("data-size", "compact");
    expect(content).toHaveClass("wenyou-prose-compact");
  });

  test("站内链接统一渲染为同页传送门，名称可自定义", () => {
    const threadId = "cmsewdo0h000x7qv6aa77ll1v";
    render(<MarkdownContent content={`参见 [设定 A](/threads/${threadId})`} />);

    const portal = screen.getByRole("link", { name: "站内传送门：设定 A" });
    expect(portal).toHaveAttribute("href", `/threads/${threadId}`);
    expect(portal).not.toHaveAttribute("target");
    expect(portal).toHaveAttribute("data-slot", "internal-reference-link");
  });

  test("裸站内链接显示默认名称，外链保持新窗口行为", () => {
    const threadId = "cmsewdo0h000x7qv6aa77ll1v";
    render(
      <MarkdownContent
        content={`入口 /threads/${threadId}?post=cmsewdqcr001a7qv6cy0y38bd，外链 [站点](https://example.com)`}
      />,
    );

    expect(screen.getByRole("link", { name: "站内传送门：传送门" })).toHaveAttribute(
      "href",
      `/threads/${threadId}?post=cmsewdqcr001a7qv6cy0y38bd`,
    );
    expect(screen.getByRole("link", { name: "站点" })).toHaveAttribute("target", "_blank");
  });

  test("GFM 吞入裸地址的中文句号时仍识别传送门并在链接外保留标点", () => {
    const threadId = "cmsewdo0h000x7qv6aa77ll1v";
    render(<MarkdownContent content={`继续阅读 https://wenyou.site/threads/${threadId}。`} />);

    const portal = screen.getByRole("link", { name: "站内传送门：传送门" });
    expect(portal).toHaveAttribute("href", `/threads/${threadId}`);
    expect(portal.closest("p")).toHaveTextContent("继续阅读 传送门。");
    expect(portal).not.toHaveTextContent("。");
  });

  test("骰子结果以和文字混排的背景色标签显示", () => {
    render(
      <MarkdownContent
        content={`前文 ${DICE_MARKER} 后文`}
        diceRolls={[{
          nodeId: DICE_NODE_ID,
          notation: "1d20",
          results: [14],
          modifier: 0,
          total: 14,
        }]}
      />,
    );

    const result = screen.getByText("1d20 = 14");
    expect(result.tagName).toBe("SPAN");
    expect(result).toHaveClass("dice-inline", "dice-inline-result");
    expect(result.closest("p")).toHaveTextContent("前文 1d20 = 14 后文");
    expect(result.querySelector("svg")).toBeNull();
  });

  test("多骰展示每一枚点数和总计", () => {
    render(
      <MarkdownContent
        content={`概率 ${DICE_MARKER}`}
        diceRolls={[{
          nodeId: DICE_NODE_ID,
          notation: "2d50",
          results: [33, 48],
          modifier: 0,
          total: 81,
        }]}
      />,
    );

    const result = screen.getByText("2d50 = [33, 48] = 81");
    expect(result).toHaveAttribute(
      "aria-label",
      "骰子 2d50，逐骰结果 33、48，总计 81",
    );
  });

  test("未发布骰子节点以内联待掷状态显示", () => {
    render(<MarkdownContent content={DICE_MARKER} />);

    const pending = screen.getByText("1d20 = ?");
    expect(pending).toHaveClass("dice-inline", "dice-inline-pending");
  });

  test("历史内容中的 Milkdown 空段落按空行渲染，不显示字面标签", () => {
    render(<MarkdownContent content={"第一段\n\n<br />\n\n第二段"} />);
    expect(screen.getByText("第一段")).toBeInTheDocument();
    expect(screen.getByText("第二段")).toBeInTheDocument();
    expect(screen.queryByText(/<br\s*\/>/i)).not.toBeInTheDocument();
    expect(document.querySelectorAll("br")).toHaveLength(1);
  });

  test("完整 CommonMark/GFM 内容可渲染，表格与代码只在自身区域溢出", () => {
    render(
      <MarkdownContent
        content={[
          "##### 历史五级标题",
          "",
          "1. 有序项目",
          "2. 第二项",
          "",
          "- [x] 已完成",
          "",
          "| 名称 | 数量 |",
          "| --- | ---: |",
          "| 骰子 | 2 |",
          "",
          "```ts",
          "const veryLongValue = '不会撑宽整张帖子卡片';",
          "```",
        ].join("\n")}
      />,
    );

    expect(screen.getByRole("heading", { level: 5, name: "历史五级标题" })).toBeInTheDocument();
    expect(document.querySelector("ol")).toBeInTheDocument();
    expect(document.querySelector('input[type="checkbox"]')).toBeChecked();
    expect(document.querySelector('[data-slot="markdown-table-scroll"]')).toHaveClass(
      "max-w-full",
      "overflow-x-auto",
    );
    expect(document.querySelector('[data-slot="markdown-code-scroll"]')).toHaveClass(
      "max-w-full",
      "overflow-x-auto",
    );
  });

  test("空 URL 图片不渲染破图", () => {
    render(<MarkdownContent content={"![1.00]()"} />);
    expect(screen.queryByRole("img")).toBeNull();
  });

  test("本站上传图渲染为中图并带尺寸约束与懒加载", () => {
    render(<MarkdownContent content={`![测试图](${UPLOADED_URL})`} />);
    const img = screen.getByRole("img", { name: "测试图" });
    expect(img).toHaveAttribute("src", UPLOADED_MD_URL);
    expect(img).toHaveAttribute("loading", "lazy");
    expect(img).toHaveAttribute("class", expect.stringContaining("max-w-full"));
    expect(img).toHaveAttribute(
      "style",
      expect.stringContaining("max-width: 100%"),
    );
    expect(img).toHaveAttribute(
      "style",
      expect.stringContaining("max-height: 50vh"),
    );
  });

  test("帖子表情使用共享 128px 上限，不被普通 prose 图片规则放大", () => {
    render(
      <MarkdownContent
        content={'![表情](https://cdn.example.com/stickers/asset.webp "wenyousite-sticker:v1:asset-1")'}
      />,
    );

    const sticker = screen.getByRole("img", { name: "表情" });
    expect(sticker).toHaveClass("sticker-display");
    expect(sticker.getAttribute("style")).toContain("--sticker-display-max");
  });

  test.each([
    "https://cos.example.com/wenyou/uploads/2026/01/01/u1/animated.gif",
    "https://cos.example.com/wenyou/uploads/2026/01/01/u1/animated.GIF?version=1#preview",
  ])("本站 GIF 默认渲染原图以自动播放：%s", (gifUrl) => {
    render(<MarkdownContent content={`![动态图](${gifUrl})`} />);
    const img = screen.getByRole("img", { name: "动态图" });
    expect(img).toHaveAttribute("src", gifUrl);
    expect(img).toHaveAttribute("loading", "lazy");
  });

  test("站外图片保持原 URL，不做中图替换", () => {
    render(<MarkdownContent content={`![外部图](${EXTERNAL_URL})`} />);
    const img = screen.getByRole("img", { name: "外部图" });
    expect(img).toHaveAttribute("src", EXTERNAL_URL);
    expect(img).toHaveAttribute("class", expect.stringContaining("max-w-full"));
  });

  test("SVG 上传图不替换为中图", () => {
    const svgUrl =
      "https://cos.example.com/wenyou/uploads/2026/01/01/u1/icon.svg";
    render(<MarkdownContent content={`![图标](${svgUrl})`} />);
    expect(screen.getByRole("img", { name: "图标" })).toHaveAttribute(
      "src",
      svgUrl,
    );
  });

  test("中图加载失败时回退到原图", async () => {
    render(<MarkdownContent content={`![测试图](${UPLOADED_URL})`} />);
    const img = screen.getByRole("img", { name: "测试图" });
    expect(img).toHaveAttribute("src", UPLOADED_MD_URL);
    fireEvent.error(img);
    expect(await screen.findByRole("img", { name: "测试图" })).toHaveAttribute(
      "src",
      UPLOADED_URL,
    );
  });

  test("点击图片打开原图 lightbox，再点击遮罩关闭", async () => {
    const user = userEvent.setup();
    render(<MarkdownContent content={`![测试图](${UPLOADED_URL})`} />);
    await user.click(screen.getByRole("img", { name: "测试图" }));

    const dialog = screen.getByRole("dialog", { name: "查看原图" });
    expect(dialog).toBeInTheDocument();
    const lightboxImg = within(dialog).getByRole("img", { name: "测试图" });
    expect(lightboxImg).toHaveAttribute("src", UPLOADED_URL);

    await user.click(dialog);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  test("按 Esc 键关闭 lightbox", async () => {
    const user = userEvent.setup();
    render(<MarkdownContent content={`![测试图](${UPLOADED_URL})`} />);
    await user.click(screen.getByRole("img", { name: "测试图" }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  test("正文超过视口高度时可展开并收起", async () => {
    Object.defineProperty(window, "innerHeight", { configurable: true, value: 800 });
    const scrollIntoView = vi.fn();
    HTMLElement.prototype.scrollIntoView = scrollIntoView;
    render(<MarkdownContent content={"很长的正文"} />);
    const prose = document.querySelector(".prose") as HTMLDivElement;
    Object.defineProperty(prose, "scrollHeight", { configurable: true, value: 1000 });
    fireEvent.resize(window);
    const expand = await screen.findByRole("button", { name: "展开全文" });
    expect(expand).toHaveAttribute("aria-expanded", "false");
    await userEvent.setup().click(expand);
    expect(screen.getByRole("button", { name: "收起" })).toHaveAttribute("aria-expanded", "true");
    await userEvent.setup().click(screen.getByRole("button", { name: "收起" }));
    await waitFor(() => expect(scrollIntoView).toHaveBeenCalledWith({ behavior: "auto", block: "start" }));
  });
});
