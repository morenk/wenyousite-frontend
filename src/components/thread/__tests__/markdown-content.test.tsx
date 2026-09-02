/** MarkdownContent 组件测试：图片约束尺寸、中图替换、lightbox 交互 */

import { describe, test, expect, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent, within, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MarkdownContent } from "@/components/thread/markdown-content";

afterEach(() => cleanup());

const UPLOADED_URL =
  "https://cos.example.com/wenyou/uploads/2026/01/01/u1/123-abc.jpg";
const UPLOADED_MD_URL = UPLOADED_URL.replace(/\.jpg$/, "_md.webp");
const NORMALIZED_URL = "https://cos.example.com/wenyou/media/2026/08/23/u1/123-abc.webp";
const EXTERNAL_URL = "https://example.com/pic.png";
const DICE_NODE_ID = "550e8400-e29b-41d4-a716-446655440000";
const DICE_MARKER = `[[dice:v1:${DICE_NODE_ID}:1d20]]`;

describe("MarkdownContent", () => {
  test("渲染普通 markdown 文本", () => {
    render(<MarkdownContent content={"## 标题\n\n正文内容"} />);
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

  test("实际 DeerSeek 文本恢复粗体且不显示星号或插入空格", () => {
    const content = "选择你的DeerSeek模型：**【注意注意！并不是真的AI！DeerSeek就是我！】**DeerSeek v4 pro";
    render(<MarkdownContent content={content} />);

    const paragraph = document.querySelector('[data-slot="markdown-content"] p');
    const strong = paragraph?.querySelector("strong");
    expect(strong).toHaveTextContent("【注意注意！并不是真的AI！DeerSeek就是我！】");
    expect(paragraph?.textContent).toBe(
      "选择你的DeerSeek模型：【注意注意！并不是真的AI！DeerSeek就是我！】DeerSeek v4 pro",
    );
    expect(paragraph?.textContent).not.toContain("**");
  });

  test.each([
    ["中文书名括号与中文相邻", "前**【注意】**后", "【注意】"],
    ["全角圆括号与拉丁字母相邻", "A**（Notice）**B", "（Notice）"],
    ["引号、句末感叹号与数字相邻", "1**“注意!”**2", "“注意!”"],
    ["ASCII 方括号与中文感叹号", "左**[注意！]**右", "[注意！]"],
    ["Emoji 符号边界", "前**🚨注意🚨**后", "🚨注意🚨"],
  ])("恢复同类粗体边界：%s", (_label, content, expected) => {
    render(<MarkdownContent content={content} />);
    const strong = document.querySelector('[data-slot="markdown-content"] strong');
    expect(strong).toHaveTextContent(expected);
    expect(strong?.closest("p")?.textContent).not.toContain("**");
  });

  test.each([
    ["星号斜体", "前*（斜体）*后", "em", "（斜体）"],
    ["星号粗斜体", "前***【粗斜体】***后", "em > strong", "【粗斜体】"],
    ["删除线", "前~~【删除】~~后", "del", "【删除】"],
    ["下划线斜体别名", "前_（斜体）_后", "em", "（斜体）"],
    ["下划线粗体别名", "前__【粗体】__后", "strong", "【粗体】"],
    ["下划线粗斜体别名", "前___【粗斜体】___后", "em > strong", "【粗斜体】"],
  ])("恢复其他 attention 格式：%s", (_label, content, selector, expected) => {
    render(<MarkdownContent content={content} />);
    expect(document.querySelector(`[data-slot="markdown-content"] ${selector}`))
      .toHaveTextContent(expected);
  });

  test("同一文本节点线性恢复多个不同定界符", () => {
    render(
      <MarkdownContent content="A**【粗】**B / C_（斜）_D / E~~【删】~~F" />,
    );

    expect(document.querySelector("strong")).toHaveTextContent("【粗】");
    expect(document.querySelector("em")).toHaveTextContent("（斜）");
    expect(document.querySelector("del")).toHaveTextContent("【删】");
  });

  test("同一文本节点跳过已转义片段后仍恢复后续歧义片段", () => {
    render(
      <MarkdownContent content={String.raw`\**【字面】** x**【恢复】**y`} />,
    );

    const markdown = document.querySelector('[data-slot="markdown-content"]');
    expect(markdown).toHaveTextContent("**【字面】** x【恢复】y");
    expect(markdown?.querySelectorAll("strong")).toHaveLength(1);
    expect(markdown?.querySelector("strong")).toHaveTextContent("【恢复】");
  });

  test.each([
    ["反斜杠转义", String.raw`前\**【字面】**后`, "前**【字面】**后"],
    ["未闭合定界符", "前**【未闭合】后", "前**【未闭合】后"],
    ["内容起始空白", "前** 【空白】**后", "前** 【空白】**后"],
    ["内容结束空白", "前**【空白】 **后", "前**【空白】 **后"],
    ["普通词内下划线", "foo_bar_baz", "foo_bar_baz"],
    ["更长的字面定界符", "x****【四星】****y", "x****【四星】****y"],
  ])("不扩大恢复范围：%s", (_label, content, expected) => {
    render(<MarkdownContent content={content} />);
    const markdown = document.querySelector('[data-slot="markdown-content"]');
    expect(markdown).toHaveTextContent(expected);
    expect(markdown?.querySelector("strong, em, del")).toBeNull();
  });

  test("代码、链接和图片上下文中的字面定界符不恢复", () => {
    const { rerender } = render(
      <MarkdownContent content={"`前**【代码】**后`"} />,
    );
    expect(document.querySelector("code")).toHaveTextContent("前**【代码】**后");
    expect(document.querySelector("strong, em, del")).toBeNull();

    rerender(<MarkdownContent content={"```txt\n前**【围栏】**后\n```"} />);
    expect(document.querySelector('[data-slot="markdown-content"]')).toHaveTextContent(
      "前**【围栏】**后",
    );
    expect(document.querySelector("strong, em, del")).toBeNull();

    rerender(
      <MarkdownContent content="[前**【链接】**后](https://example.com)" />,
    );
    expect(screen.getByRole("link")).toHaveTextContent("前**【链接】**后");
    expect(document.querySelector("strong, em, del")).toBeNull();

    rerender(
      <MarkdownContent content="![前**【图片】**后](https://example.com/image.png)" />,
    );
    expect(screen.getByRole("img", { name: "前**【图片】**后" })).toBeInTheDocument();
    expect(document.querySelector("strong, em, del")).toBeNull();
  });

  test("嵌套回复使用稍紧凑但不缩小到小号正文的排版", () => {
    render(<MarkdownContent content="回复正文" size="compact" />);
    const content = document.querySelector('[data-slot="markdown-content"]');
    expect(content).toHaveAttribute("data-size", "compact");
    expect(content).toHaveClass("wenyou-prose-compact");
  });

  test("引用保留原生 blockquote 语义与多段内容", () => {
    render(<MarkdownContent content={"> 第一段\n>\n> 第二段"} />);

    const quote = document.querySelector("blockquote");
    expect(quote).toBeInTheDocument();
    expect(quote).toHaveTextContent("第一段");
    expect(quote).toHaveTextContent("第二段");
    expect(quote?.querySelectorAll(":scope > p")).toHaveLength(2);
    expect(quote?.querySelector("svg")).toBeNull();
  });

  test("分隔线保留原生 thematic break 语义且不生成可见文字", () => {
    render(<MarkdownContent content={"上文\n\n---\n\n下文"} />);

    const separator = screen.getByRole("separator");
    expect(separator.tagName).toBe("HR");
    expect(separator).toBeEmptyDOMElement();
    expect(separator.querySelector("svg")).toBeNull();
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
    expect(screen.getByRole("link", { name: "站点" })).toHaveAttribute("data-slot", "content-link");
  });

  test("用户提及保留 @ 文字线索并使用独立元素语义", () => {
    render(<MarkdownContent content="欢迎 [@南枝](/users/user-1) 加入" />);

    const mention = screen.getByRole("link", { name: "@南枝" });
    expect(mention).toHaveAttribute("href", "/users/user-1");
    expect(mention).toHaveAttribute("data-slot", "mention-link");
  });

  test("GFM 吞入裸地址的中文句号时仍识别传送门并在链接外保留标点", () => {
    const threadId = "cmsewdo0h000x7qv6aa77ll1v";
    render(<MarkdownContent content={`继续阅读 https://wenyou.site/threads/${threadId}。`} />);

    const portal = screen.getByRole("link", { name: "站内传送门：传送门" });
    expect(portal).toHaveAttribute("href", `/threads/${threadId}`);
    expect(portal.closest("p")).toHaveTextContent("继续阅读 传送门。");
    expect(portal).not.toHaveTextContent("。");
  });

  test("私密帖邀请链接渲染为同页传送门", () => {
    render(
      <MarkdownContent
        content="请使用 https://wenyou.site/join/AbCdEfGh_123-XYZ 加入"
      />,
    );

    const portal = screen.getByRole("link", { name: "站内传送门：传送门" });
    expect(portal).toHaveAttribute("href", "/join/AbCdEfGh_123-XYZ");
    expect(portal).not.toHaveAttribute("target");
  });

  test("骰子结果以和文字混排且无可见展开提示的按钮显示", () => {
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
    expect(result.tagName).toBe("BUTTON");
    expect(result).toHaveClass("dice-inline", "dice-inline-result");
    expect(result.closest("p")).toHaveTextContent("前文 1d20 = 14 后文");
    expect(result.querySelector("svg")).toBeNull();
    expect(result).toHaveAttribute("aria-expanded", "false");
  });

  test("多骰点击后按服务端顺序展示数字骰盘与计算过程", async () => {
    const user = userEvent.setup();
    render(
      <MarkdownContent
        content={`概率 ${DICE_MARKER}`}
        diceRolls={[{
          nodeId: DICE_NODE_ID,
          notation: "2d50+3",
          results: [33, 48],
          modifier: 3,
          total: 84,
        }]}
      />,
    );

    const result = screen.getByRole("button", { name: "骰子 2d50+3，总计 84" });
    expect(result).toHaveTextContent("2d50+3 = 84");
    expect(result).not.toHaveAccessibleName(/33|48/u);

    await user.click(result);

    const dialog = await screen.findByRole("dialog", { name: "骰子结果" });
    expect(result).toHaveAttribute("aria-expanded", "true");
    expect(within(dialog).getByLabelText("第 1 枚，33 点")).toHaveTextContent("33");
    expect(within(dialog).getByLabelText("第 2 枚，48 点")).toHaveTextContent("48");
    expect(within(dialog).getByText("骰面小计").nextElementSibling).toHaveTextContent("81");
    expect(within(dialog).getByText("修正").nextElementSibling).toHaveTextContent("+3");
    expect(within(dialog).getByText("总计").nextElementSibling).toHaveTextContent("84");

    await user.click(within(dialog).getByRole("button", { name: "关闭骰子结果" }));
    await waitFor(() => expect(dialog).not.toBeInTheDocument());
    expect(result).toHaveFocus();
  });

  test("100 枚骰子的详情在固定上限浮层内完整渲染", async () => {
    const user = userEvent.setup();
    const results = Array.from({ length: 100 }, (_, index) => (index % 100) + 1);
    render(
      <MarkdownContent
        content={DICE_MARKER}
        diceRolls={[{
          nodeId: DICE_NODE_ID,
          notation: "100d100",
          results,
          modifier: 0,
          total: results.reduce((sum, value) => sum + value, 0),
        }]}
      />,
    );

    await user.click(screen.getByRole("button", { name: "骰子 100d100，总计 5050" }));
    const dialog = await screen.findByRole("dialog", { name: "骰子结果" });
    expect(dialog).toHaveClass("overflow-y-auto", "overscroll-contain");
    expect(within(dialog).getAllByRole("listitem")).toHaveLength(100);
    expect(within(dialog).getByLabelText("第 100 枚，100 点")).toBeInTheDocument();
    expect(within(dialog).queryByText("修正")).not.toBeInTheDocument();
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

  test("连续协议空段逐个渲染，不会被 HTML 解析合并后丢弃", () => {
    render(
      <MarkdownContent
        content={"第一段\n\n<br />\n<br>\n<br/>\n\n第二段"}
      />,
    );

    expect(screen.queryByText(/<br\s*\/?\s*>/iu)).not.toBeInTheDocument();
    expect(document.querySelectorAll('[data-slot="markdown-content"] br')).toHaveLength(3);
  });

  test("开头协议空段与正文相邻时不会吞掉整篇正文", () => {
    render(
      <MarkdownContent
        content={["<br />", "第一行正文", "<br />", "第二行正文"].join("\n")}
      />,
    );

    const markdown = document.querySelector('[data-slot="markdown-content"]');
    expect(markdown).toHaveTextContent("第一行正文");
    expect(markdown).toHaveTextContent("第二行正文");
    expect(markdown).not.toHaveTextContent(/<br\s*\/?\s*>/iu);
  });

  test("历史原始连续空行按多余行数恢复，普通段落间隔不增加留白", () => {
    const { rerender } = render(
      <MarkdownContent content={"第一段\n\n第二段"} />,
    );
    expect(document.querySelectorAll('[data-slot="markdown-content"] br')).toHaveLength(0);

    rerender(<MarkdownContent content={"第一段\n\n\n\n第二段"} />);
    expect(document.querySelectorAll('[data-slot="markdown-content"] br')).toHaveLength(2);
  });

  test("历史首尾连续空行也逐个恢复", () => {
    render(<MarkdownContent content={"\n\n正文\n\n\n"} />);
    expect(document.querySelectorAll('[data-slot="markdown-content"] br')).toHaveLength(4);
  });

  test("完整正文保留段落内软换行并按阅读语义解码空格实体", () => {
    render(
      <MarkdownContent
        content={"另一种形式的开\n始？\n\n&#x20;  没有死亡的人，无法给出答案。"}
      />,
    );

    const paragraphs = document.querySelectorAll('[data-slot="markdown-content"] p');
    expect(paragraphs).toHaveLength(2);
    expect(paragraphs[0]?.querySelectorAll("br")).toHaveLength(1);
    expect(paragraphs[0]).toHaveTextContent("另一种形式的开 始？");
    expect(paragraphs[1]).toHaveTextContent("没有死亡的人，无法给出答案。");
    expect(document.body).not.toHaveTextContent("&#x20;");
  });

  test("历史白名单外结构只显示源码字符，不生成结构节点", () => {
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

    expect(screen.getByText("##### 历史五级标题")).toBeInTheDocument();
    expect(document.querySelector("ol")).toBeInTheDocument();
    expect(document.querySelector("h5")).toBeNull();
    expect(document.querySelector('input[type="checkbox"]')).toBeNull();
    expect(document.querySelector("table")).toBeNull();
    expect(document.querySelector("pre")).toBeNull();
    expect(screen.getByText("- [x] 已完成")).toBeInTheDocument();
    expect(screen.getByText("```ts")).toBeInTheDocument();
  });

  test("原始 HTML 显示为字面文字且不会执行", () => {
    render(<MarkdownContent content={'<script>window.evil = true</script>'} />);
    expect(screen.getByText('<script>window.evil = true</script>')).toBeInTheDocument();
    expect(document.querySelector("script")).toBeNull();
  });

  test("空 URL 图片不渲染破图", () => {
    render(<MarkdownContent content={"![1.00]()"} />);
    expect(screen.queryByRole("img")).toBeNull();
  });

  test("普通图片默认居左，表情仍保持内联语义", () => {
    const { container } = render(
      <MarkdownContent
        content={'![普通图](https://example.com/image.png) ![表情](https://example.com/sticker.webp "wenyousite-sticker:v1:asset-1")'}
      />,
    );

    const image = screen.getByRole("img", { name: "普通图" });
    const sticker = screen.getByRole("img", { name: "表情" });
    expect(image.closest("span")).toHaveAttribute("data-wenyou-media", "image");
    expect(image.closest("span")).toHaveClass("mx-0", "block");
    expect(sticker.closest("span")).not.toHaveAttribute("data-wenyou-media");
    expect(container.querySelector("p")).not.toHaveAttribute("data-wenyou-align");
  });

  test("契约 v5 的独立图片可读取并应用中心对齐", () => {
    render(
      <MarkdownContent
        markdownContractVersion={5}
        content={'[wenyousite-align-v1-center]: #\n![居中图](https://example.com/image.png)'}
      />,
    );

    const paragraph = document.querySelector('[data-slot="markdown-content"] > p');
    expect(paragraph).toHaveAttribute("data-wenyou-align", "center");
    expect(screen.getByRole("img", { name: "居中图" })).toBeInTheDocument();
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

  test("新标准化主图路径同样使用正文中图", () => {
    render(<MarkdownContent content={`![标准化图片](${NORMALIZED_URL})`} />);
    expect(screen.getByRole("img", { name: "标准化图片" })).toHaveAttribute(
      "src",
      NORMALIZED_URL.replace(/\.webp$/, "_md.webp"),
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

  test("含连续空段的长正文始终完整显示且不提供折叠控件", () => {
    Object.defineProperty(window, "innerHeight", { configurable: true, value: 800 });
    render(<MarkdownContent content={"很长的正文\n\n<br />\n<br />\n<br />\n\n结尾"} />);
    const prose = document.querySelector(".prose") as HTMLDivElement;
    expect(prose.querySelectorAll("br")).toHaveLength(3);
    Object.defineProperty(prose, "scrollHeight", { configurable: true, value: 1000 });
    fireEvent.resize(window);
    expect(prose).not.toHaveStyle({ maxHeight: "80vh", overflow: "hidden" });
    expect(screen.queryByRole("button", { name: "展开全文" })).toBeNull();
    expect(screen.queryByRole("button", { name: "收起" })).toBeNull();
    expect(prose.querySelectorAll("br")).toHaveLength(3);
  });
});
