import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { MarkdownContent } from "@/components/thread/markdown-content";
import type { InlineDiceRoll } from "@/lib/dice-inline";
import {
  createReaderClipboardPayload,
  createReaderSelectionClipboardPayload,
  createSiteClipboardPayloadFromNodes,
  parseSiteClipboardHtml,
  SITE_CLIPBOARD_MEDIA_ATTRIBUTE,
  writeSiteClipboardPayload,
} from "@/lib/site-clipboard";

interface ReaderCopyCase {
  id: string;
  kind: "reader-copy";
  markdown: string;
  diceRolls?: InlineDiceRoll[];
  expectedPlainText: string;
}

const contract = JSON.parse(
  readFileSync(
    resolve(process.cwd(), "contracts/editor-clipboard-v1-fixtures.json"),
    "utf8",
  ),
) as {
  contract: string;
  version: number;
  mobileTransport: {
    structuredCarrier: string;
    systemClipboardPayload: string;
    systemClipboardMarker: string;
    requiredMatch: string[];
    maximumAgeSeconds: number;
    interoperability: string;
  };
  plainTextFallback: {
    projection: string;
    generatedMarkdownDelimiters: string;
    userVisibleLiteralCharacters: string;
    atomicTargetsAndHiddenIds: string;
  };
  entryPoints: Array<{ platform: string; surface: string; copyMode: string }>;
  nodeRules: Array<{ nodeType: string }>;
  goldenCases: Array<ReaderCopyCase | { id: string; kind: string }>;
};

const readerCases = contract.goldenCases.filter(
  (item): item is ReaderCopyCase => item.kind === "reader-copy",
);

afterEach(() => {
  cleanup();
  window.getSelection()?.removeAllRanges();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("站内剪贴板 v1", () => {
  test("共享契约固定 Web/Flutter 入口和六类节点", () => {
    expect(contract).toMatchObject({
      contract: "wenyousite-editor-clipboard",
      version: 1,
      mobileTransport: {
        structuredCarrier: "in-process-delta",
        systemClipboardPayload: "visible-text",
        systemClipboardMarker: "random-per-capture",
        maximumAgeSeconds: 600,
        interoperability: "plain-text-only",
      },
      plainTextFallback: {
        projection: "rendered-visible-text",
        generatedMarkdownDelimiters: "omit",
        userVisibleLiteralCharacters: "preserve",
        atomicTargetsAndHiddenIds: "omit",
      },
    });
    expect(contract.entryPoints).toHaveLength(6);
    expect(contract.entryPoints).toEqual(expect.arrayContaining([
      expect.objectContaining({ platform: "web", surface: "reader-selection", copyMode: "structured" }),
      expect.objectContaining({ platform: "web", surface: "reader-menu", copyMode: "structured" }),
      expect.objectContaining({ platform: "web", surface: "editor", copyMode: "structured" }),
      expect.objectContaining({ platform: "mobile", surface: "reader-selection", copyMode: "visible-text" }),
      expect.objectContaining({ platform: "mobile", surface: "reader-menu", copyMode: "structured" }),
      expect.objectContaining({ platform: "mobile", surface: "editor", copyMode: "structured" }),
    ]));
    expect(new Set(contract.mobileTransport.requiredMatch)).toEqual(new Set([
      "visible-text",
      "marker",
      "authenticated-session",
      "maximum-age",
    ]));
    expect(new Set(contract.nodeRules.map((rule) => rule.nodeType))).toEqual(new Set([
      "internal_reference",
      "mention",
      "mention_all_players",
      "dice",
      "image",
      "sticker",
    ]));
  });

  test.each(readerCases)("$id 生成受限 HTML 和黄金可见文本", (fixture) => {
    const { container } = render(
      <MarkdownContent content={fixture.markdown} diceRolls={fixture.diceRolls} />,
    );
    const root = container.querySelector<HTMLElement>('[data-slot="markdown-content"]')!;
    const payload = createReaderClipboardPayload(root);
    const parsed = parseSiteClipboardHtml(payload.html);

    expect(payload.source).toBe("reader");
    expect(payload.text).toBe(fixture.expectedPlainText);
    expect(parsed).toEqual(payload);
    expect(payload.html).toContain('data-wenyou-clipboard="1"');
    expect(payload.html).not.toMatch(/\s(?:class|style|onclick)=/iu);
  });

  test("富格式黄金用例保留白名单结构", () => {
    const fixture = readerCases.find((item) => item.id === "reader-rich-structure")!;
    const { container } = render(<MarkdownContent content={fixture.markdown} />);
    const root = container.querySelector<HTMLElement>('[data-slot="markdown-content"]')!;
    const template = document.createElement("template");
    template.innerHTML = createReaderClipboardPayload(root).html;

    for (const selector of ["h2", "strong", "em", "del", "code", "blockquote", "ul", "hr"]) {
      expect(template.content.querySelector(selector)).not.toBeNull();
    }
  });

  test("阅读端原子节点保留语义而媒体只留下标签", () => {
    const fixture = readerCases.find((item) => item.id === "reader-atoms-and-media")!;
    const { container } = render(<MarkdownContent content={fixture.markdown} />);
    const root = container.querySelector<HTMLElement>('[data-slot="markdown-content"]')!;
    const payload = createReaderClipboardPayload(root);
    const template = document.createElement("template");
    template.innerHTML = payload.html;

    expect(template.content.querySelector('a[href="/threads/cmsewdo0h000x7qv6aa77ll1v"]'))
      .toHaveTextContent("传送门");
    expect(template.content.querySelector('a[href="/users/user-zhang"]'))
      .toHaveTextContent("@张三");
    expect(template.content.querySelector('[data-type="dice_inline"]'))
      .toHaveAttribute("data-notation", "1d20+2");
    expect(payload.html).not.toContain("<img");
    expect(payload.html).not.toContain("cm1234567890123456789012");
    expect(payload.text).toContain("[表情]");
    expect(payload.text).toContain("[图片]");
  });

  test("已结算骰子的纯文本保留可见结果而结构只携带表达式", () => {
    const fixture = readerCases.find(
      (item) => item.id === "reader-settled-dice-discards-result-on-paste",
    )!;
    const { container } = render(
      <MarkdownContent content={fixture.markdown} diceRolls={fixture.diceRolls} />,
    );
    const root = container.querySelector<HTMLElement>('[data-slot="markdown-content"]')!;
    const payload = createReaderClipboardPayload(root);
    const template = document.createElement("template");
    template.innerHTML = payload.html;
    const dice = template.content.querySelector<HTMLElement>('[data-type="dice_inline"]')!;

    expect(payload.text).toBe(fixture.expectedPlainText);
    expect(dice).toHaveAttribute("data-notation", "2d6+1");
    expect(dice).toHaveTextContent("2d6+1 = 11");
    expect(payload.html).not.toMatch(/results|total|modifier/iu);
  });

  test("选区端点落在原子节点内部时扩展为完整节点", () => {
    const { container } = render(
      <MarkdownContent content="前 [完整传送门](/threads/cmsewdo0h000x7qv6aa77ll1v) 后" />,
    );
    const root = container.querySelector<HTMLElement>('[data-slot="markdown-content"]')!;
    const label = root.querySelector<HTMLElement>('[data-slot="internal-reference-label"]')!;
    const range = document.createRange();
    range.setStart(label.firstChild!, 1);
    range.setEnd(label.firstChild!, 3);
    const selection = window.getSelection()!;
    selection.removeAllRanges();
    selection.addRange(range);

    const payload = createReaderSelectionClipboardPayload(root, selection)!;
    expect(payload.text).toBe("完整传送门");
    expect(payload.html).toContain('href="/threads/cmsewdo0h000x7qv6aa77ll1v"');
  });

  test("阅读组件 copy 事件同步写入 HTML 与可见文本两种 MIME", () => {
    const { container } = render(<MarkdownContent content="**站内粗体**" />);
    const root = container.querySelector<HTMLElement>('[data-slot="markdown-content"]')!;
    const text = root.querySelector("strong")!.firstChild!;
    const range = document.createRange();
    range.selectNodeContents(text);
    const selection = window.getSelection()!;
    selection.removeAllRanges();
    selection.addRange(range);
    const setData = vi.fn();

    fireEvent.copy(root, { clipboardData: { setData } });

    expect(setData).toHaveBeenCalledWith(
      "text/html",
      expect.stringContaining("<strong>站内粗体</strong>"),
    );
    expect(setData).toHaveBeenCalledWith("text/plain", "站内粗体");
  });

  test("跨正文选区不生成结构化片段", () => {
    const { container } = render(
      <>
        <MarkdownContent content="第一段" />
        <MarkdownContent content="第二段" />
      </>,
    );
    const roots = container.querySelectorAll<HTMLElement>('[data-slot="markdown-content"]');
    const range = document.createRange();
    range.setStart(roots[0]!.querySelector("p")!.firstChild!, 0);
    range.setEnd(roots[1]!.querySelector("p")!.firstChild!, 3);
    const selection = window.getSelection()!;
    selection.removeAllRanges();
    selection.addRange(range);

    expect(createReaderSelectionClipboardPayload(roots[0]!, selection)).toBeNull();
    const setData = vi.fn();
    fireEvent.copy(roots[0]!, { clipboardData: { setData } });
    expect(setData).toHaveBeenCalledOnce();
    expect(setData).toHaveBeenCalledWith("text/plain", "第一段第二段");
    expect(setData).not.toHaveBeenCalledWith("text/html", expect.any(String));
  });

  test("编辑器来源保留媒体节点，阅读来源统一标签化", () => {
    const source = document.createElement("div");
    source.innerHTML = [
      '<img data-type="image-block" src="https://cdn.example.com/a.webp" caption="图" ratio="1.5">',
      '<img data-type="sticker-inline" data-asset-id="asset-1" src="https://cdn.example.com/s.webp" alt="表情">',
    ].join("");
    const editorPayload = createSiteClipboardPayloadFromNodes(source.childNodes, "editor");

    expect(editorPayload.html).toContain('data-type="image-block"');
    expect(editorPayload.html).toContain('data-type="sticker-inline"');
    expect(editorPayload.text).toBe("[图片]\n\n[表情]");

    for (const image of source.querySelectorAll("img")) {
      image.setAttribute(
        SITE_CLIPBOARD_MEDIA_ATTRIBUTE,
        image.getAttribute("data-type") === "sticker-inline" ? "sticker" : "image",
      );
    }
    const readerPayload = createSiteClipboardPayloadFromNodes(source.childNodes, "reader");
    expect(readerPayload.html).not.toContain("<img");
    expect(readerPayload.text).toBe("[图片][表情]");
  });

  test("结构恢复会静默降级危险链接、畸形原子与不安全媒体", () => {
    const source = document.createElement("div");
    source.innerHTML = [
      '<a href="javascript:alert(1)"><strong>危险链接文字</strong></a>',
      '<a href="mailto:test@example.com">邮件</a>',
      '<span data-type="dice_inline" data-node-id="bad-id" data-notation="1d6">坏骰</span>',
      '<span data-type="dice_inline" data-node-id="123e4567-e89b-42d3-a456-426614174000" data-notation="1d6"></span>',
      '<img src="javascript:alert(1)">',
      '<img data-type="sticker-inline" data-asset-id="bad id" src="https://cdn.example.com/s.webp">',
      '<img data-type="image-block" src="https://cdn.example.com/a.webp" ratio="NaN">',
      '<ol start="3"><li><p>第一项<br>续行</p></li><li>第二项</li></ol>',
    ].join("");

    const payload = createSiteClipboardPayloadFromNodes(source.childNodes, "editor");
    const template = document.createElement("template");
    template.innerHTML = payload.html;

    expect(template.content.querySelector('a[href^="javascript:"]')).toBeNull();
    expect(template.content.querySelector('a[href="mailto:test@example.com"]'))
      .toHaveTextContent("邮件");
    expect(payload.html).toContain("危险链接文字");
    expect(payload.html).toContain("坏骰");
    expect(template.content.querySelector('[data-node-id="123e4567-e89b-42d3-a456-426614174000"]'))
      .toHaveTextContent("1d6");
    expect(template.content.querySelector('img[src^="javascript:"]')).toBeNull();
    expect(template.content.querySelector('[data-type="sticker-inline"]')).toBeNull();
    expect(template.content.querySelector('[data-type="image-block"]')).toHaveAttribute("ratio", "1");
    expect(template.content.querySelector("ol")).toHaveAttribute("start", "3");
    expect(payload.text).toContain("3. 第一项\n续行\n4. 第二项");
  });

  test("未知版本拒绝结构恢复，合法 envelope 仍会清除脚本和样式", () => {
    expect(parseSiteClipboardHtml("")).toBeNull();
    expect(parseSiteClipboardHtml("x".repeat(1_000_001))).toBeNull();
    expect(parseSiteClipboardHtml("<p>没有 envelope</p>")).toBeNull();
    expect(parseSiteClipboardHtml([
      '<div data-wenyou-clipboard="1" data-wenyou-clipboard-source="reader">一</div>',
      '<div data-wenyou-clipboard="1" data-wenyou-clipboard-source="reader">二</div>',
    ].join(""))).toBeNull();
    expect(parseSiteClipboardHtml(
      '<div data-wenyou-clipboard="999" data-wenyou-clipboard-source="reader">内容</div>',
    )).toBeNull();
    expect(parseSiteClipboardHtml(
      '<div data-wenyou-clipboard="1" data-wenyou-clipboard-source="external">内容</div>',
    )).toBeNull();

    const parsed = parseSiteClipboardHtml([
      '<div data-wenyou-clipboard="1" data-wenyou-clipboard-source="reader">',
      '<script>window.evil=true</script>',
      '<p style="color:red" onclick="evil()"><strong>安全文字</strong></p>',
      '</div>',
    ].join(""))!;
    expect(parsed.text).toBe("安全文字");
    expect(parsed.html).not.toMatch(/script|style=|onclick=/iu);
  });

  test("富剪贴板写入不可用时回退为可见纯文本", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });
    await writeSiteClipboardPayload({
      source: "reader",
      html: '<div data-wenyou-clipboard="1">结构</div>',
      text: "可见文字",
    });
    expect(writeText).toHaveBeenCalledWith("可见文字");
  });

  test("富格式写入失败会回退，缺少任一可用剪贴板 API 时显式失败", async () => {
    const payload = {
      source: "reader" as const,
      html: '<div data-wenyou-clipboard="1">结构</div>',
      text: "可见文字",
    };
    const write = vi.fn().mockRejectedValue(new Error("rich clipboard unsupported"));
    const writeText = vi.fn().mockResolvedValue(undefined);
    class TestClipboardItem {}
    vi.stubGlobal("ClipboardItem", TestClipboardItem);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { write, writeText },
    });

    await writeSiteClipboardPayload(payload);
    expect(write).toHaveBeenCalledOnce();
    expect(writeText).toHaveBeenCalledWith("可见文字");

    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {},
    });
    await expect(writeSiteClipboardPayload(payload)).rejects.toThrow("Clipboard text API unavailable");

    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: undefined,
    });
    await expect(writeSiteClipboardPayload(payload)).rejects.toThrow("Clipboard API unavailable");
  });

  test("整篇菜单支持 ClipboardItem 时原子写入富格式和纯文本", async () => {
    const write = vi.fn().mockResolvedValue(undefined);
    const writeText = vi.fn().mockResolvedValue(undefined);
    const captured: Array<Record<string, Blob>> = [];
    class TestClipboardItem {
      constructor(data: Record<string, Blob>) {
        captured.push(data);
      }
    }
    vi.stubGlobal("ClipboardItem", TestClipboardItem);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { write, writeText },
    });

    await writeSiteClipboardPayload({
      source: "reader",
      html: '<div data-wenyou-clipboard="1" data-wenyou-clipboard-source="reader"><strong>结构</strong></div>',
      text: "结构",
    });

    expect(write).toHaveBeenCalledOnce();
    expect(writeText).not.toHaveBeenCalled();
    expect(captured).toHaveLength(1);
    expect(captured[0]).toEqual(expect.objectContaining({
      "text/html": expect.any(Blob),
      "text/plain": expect.any(Blob),
    }));
  });
});
