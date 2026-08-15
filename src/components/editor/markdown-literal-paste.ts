import { Fragment, Slice } from "@milkdown/kit/prose/model";
import type { EditorView } from "@milkdown/kit/prose/view";
import { findUnsupportedMarkdownFormats } from "@/lib/markdown";

const UNSUPPORTED_HTML_STRUCTURE_RE = /<(?:table|thead|tbody|tfoot|tr|th|td|caption|colgroup|col|pre|h1|h[4-6]|input)\b|\bdata-checked\s*=|\btype\s*=\s*["']?checkbox/iu;
const BLOCK_TAGS = new Set([
  "ADDRESS", "ARTICLE", "ASIDE", "BLOCKQUOTE", "DIV", "FIGCAPTION", "FIGURE",
  "FOOTER", "HEADER", "H1", "H2", "H3", "H4", "H5", "H6", "LI", "MAIN",
  "NAV", "OL", "P", "PRE", "SECTION", "TABLE", "TR", "UL",
]);

export function htmlContainsUnsupportedMarkdownStructure(html: string): boolean {
  return UNSUPPORTED_HTML_STRUCTURE_RE.test(html);
}

/** text/plain 缺失时，从 HTML 中提取稳定的 LF 文本，不执行其中的标签。 */
export function extractClipboardHtmlText(html: string): string {
  const template = document.createElement("template");
  template.innerHTML = html;
  let output = "";
  const append = (value: string) => {
    output += value;
  };
  const visit = (node: Node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      append(node.textContent ?? "");
      return;
    }
    if (!(node instanceof HTMLElement)) {
      node.childNodes.forEach(visit);
      return;
    }
    if (node.tagName === "BR") {
      append("\n");
      return;
    }
    const before = output.length;
    node.childNodes.forEach(visit);
    if ((node.tagName === "TD" || node.tagName === "TH") && output.length > before) {
      append("\t");
    } else if (BLOCK_TAGS.has(node.tagName) && output.length > before && !output.endsWith("\n")) {
      append("\n");
    }
  };
  template.content.childNodes.forEach(visit);
  template.remove();
  return output.replace(/[\t ]+\n/gu, "\n").replace(/\n+$/u, "");
}

function insertLiteralParagraphs(view: EditorView, text: string) {
  const paragraph = view.state.schema.nodes.paragraph;
  if (!paragraph) return false;
  const nodes = text.replace(/\r\n?/g, "\n").split("\n").map((line) =>
    paragraph.create(null, line ? view.state.schema.text(line) : undefined),
  );
  view.dispatch(
    view.state.tr.replaceSelection(new Slice(Fragment.fromArray(nodes), 0, 0)).scrollIntoView(),
  );
  return true;
}

/** 只接管白名单外剪贴板；支持的 Markdown/HTML 继续交给 Milkdown 原生粘贴链路。 */
export function handleUnsupportedMarkdownPaste(view: EditorView, event: ClipboardEvent): boolean {
  const clipboard = event.clipboardData;
  if (!clipboard) return false;
  const plain = clipboard.getData("text/plain");
  const html = clipboard.getData("text/html");
  const unsupportedHtml = html.length > 0 && htmlContainsUnsupportedMarkdownStructure(html);
  const unsupportedPlain = html.length === 0 && findUnsupportedMarkdownFormats(plain).length > 0;
  if (!unsupportedHtml && !unsupportedPlain) return false;
  const text = plain || extractClipboardHtmlText(html);
  if (!text || !insertLiteralParagraphs(view, text)) return false;
  event.preventDefault();
  event.stopImmediatePropagation();
  return true;
}
