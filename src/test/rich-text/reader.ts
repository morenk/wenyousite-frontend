import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MarkdownContent } from "@/components/thread/markdown-content";
import { SITE_CLIPBOARD_MEDIA_ATTRIBUTE } from "@/lib/site-clipboard";

type Inline = Record<string, unknown>;
function readInline(parent: Element, marks: Record<string, unknown> = {}): Inline[] {
  const result: Inline[] = [];
  for (const child of parent.childNodes) {
    if (child.nodeType === Node.TEXT_NODE) {
      // mdast break 渲染为 <br> 后附加一个格式化换行；CSS normal 不把它视为第二次软换行。
      const text = child.previousSibling instanceof Element && child.previousSibling.tagName === "BR"
        ? child.textContent?.replace(/^\n/u, "") : child.textContent;
      if (text) result.push({ type: "text", text, marks });
      continue;
    }
    if (!(child instanceof Element)) continue;
    const tag = child.tagName.toLowerCase();
    if (tag === "br") { result.push({ type: "softBreak" }); continue; }
    if (child.hasAttribute("data-dice-node-id")) {
      result.push({ type: "dice", nodeId: child.getAttribute("data-dice-node-id"), notation: child.getAttribute("data-dice-notation") });
      continue;
    }
    const href = child.getAttribute("href");
    const user = href && /^\/users\/([^/]+)$/u.exec(href);
    if (tag === "a" && user && child.textContent?.startsWith("@")) {
      result.push({ type: "mention", userId: user[1], label: child.textContent }); continue;
    }
    const mark = ({ strong: "bold", em: "italic", del: "strikethrough", code: "code" } as Record<string, string>)[tag];
    if (tag !== "span" && tag !== "a" && !mark) throw new Error(`Unmapped reader inline: ${tag}`);
    result.push(...readInline(child, { ...marks, ...(mark ? { [mark]: true } : {}), ...(tag === "a" ? { link: href } : {}) }));
  }
  return result.reduce<Inline[]>((merged, item) => {
    const previous = merged.at(-1);
    if (previous?.type === "text" && item.type === "text" && JSON.stringify(previous.marks) === JSON.stringify(item.marks)) {
      previous.text = String(previous.text) + String(item.text);
    } else merged.push(item);
    return merged;
  }, []);
}
function readBlock(node: Element): unknown {
  const tag = node.tagName.toLowerCase();
  if (tag === "blockquote") return { type: "blockquote", children: [...node.children].map(readBlock) };
  if (tag !== "p" && !/^h[1-6]$/u.test(tag)) throw new Error(`Unmapped reader block: ${tag}`);
  return { type: tag === "p" ? "paragraph" : "heading", ...(tag === "p" ? {} : { level: Number(tag[1]) }),
    alignment: node.getAttribute("data-wenyou-align") || "left",
    children: node.getAttribute("data-wenyou-empty-row") === "true" ? [] : readInline(node) };
}
/** 实际生产阅读器的 DOM 语义；不读取编辑模型，也不从预期补回 DOM 未暴露的贴纸身份。 */
export function summarizeReader(canonical: string): { blocks: unknown[] } | null {
  const template = document.createElement("template");
  template.innerHTML = renderToStaticMarkup(createElement(MarkdownContent, { content: canonical }));
  const root = template.content.querySelector('[data-slot="markdown-content"]')!;
  if (root.querySelector(`img[${SITE_CLIPBOARD_MEDIA_ATTRIBUTE}="sticker"]`)) return null;
  return { blocks: [...root.children].map(readBlock) };
}
