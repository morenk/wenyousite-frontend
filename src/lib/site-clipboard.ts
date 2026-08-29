import { parseDiceNotation } from "@/lib/dice";
import {
  DICE_INLINE_NODE_NAME,
  formatInlineDicePending,
} from "@/lib/dice-inline";
import { STICKER_INLINE_NODE_NAME } from "@/lib/sticker-inline";
import {
  isStoredWenyouTextAlignment,
  WENYOU_ALIGNMENT_ATTRIBUTE,
} from "@/lib/markdown-alignment";

export const SITE_CLIPBOARD_VERSION = "2";
export const SITE_CLIPBOARD_VERSION_ATTRIBUTE = "data-wenyou-clipboard";
export const SITE_CLIPBOARD_SOURCE_ATTRIBUTE = "data-wenyou-clipboard-source";
export const SITE_CLIPBOARD_MEDIA_ATTRIBUTE = "data-wenyou-clipboard-media";

export type SiteClipboardSource = "reader" | "editor";
export type SiteClipboardMedia = "image" | "sticker";

export interface SiteClipboardPayload {
  source: SiteClipboardSource;
  html: string;
  text: string;
}

const DICE_NODE_ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const STICKER_ASSET_ID_RE = /^[a-zA-Z0-9_-]{1,128}$/u;
const DROP_CONTENT_TAGS = new Set([
  "BUTTON",
  "IFRAME",
  "INPUT",
  "NOSCRIPT",
  "OBJECT",
  "SCRIPT",
  "SELECT",
  "STYLE",
  "SVG",
  "TEXTAREA",
]);
const BLOCK_TAGS = new Set([
  "BLOCKQUOTE",
  "H2",
  "H3",
  "P",
]);
const INLINE_SELECTION_WRAPPER_TAGS = new Set(["A", "CODE", "DEL", "EM", "STRONG"]);
const ATOMIC_READER_SELECTOR = [
  '[data-slot="internal-reference-link"]',
  '[data-slot="mention-link"]',
  "[data-dice-node-id]",
  `[${SITE_CLIPBOARD_MEDIA_ATTRIBUTE}]`,
].join(",");

function isSafeHref(value: string, image = false): boolean {
  if (!value || value.length > 2_048 || /[\u0000-\u001f\u007f]/u.test(value)) return false;
  if (/^(?:https?:\/\/|\/)/iu.test(value)) return true;
  return !image && /^(?:mailto:|#)/iu.test(value);
}

function appendChildren(
  source: Element,
  target: Node,
  clipboardSource: SiteClipboardSource,
  preserveAlignment: boolean,
) {
  for (const child of Array.from(source.childNodes)) {
    if (
      (source.tagName === "UL" || source.tagName === "OL")
      && child.nodeType === Node.TEXT_NODE
      && !child.textContent?.trim()
    ) {
      continue;
    }
    appendNormalizedNode(child, target, clipboardSource, preserveAlignment);
  }
}

function appendDiceNode(
  source: Element,
  target: Node,
): boolean {
  const nodeId = source.getAttribute("data-dice-node-id")
    ?? source.getAttribute("data-node-id")
    ?? "";
  const notationInput = source.getAttribute("data-dice-notation")
    ?? source.getAttribute("data-notation")
    ?? "";
  const notation = parseDiceNotation(notationInput)?.notation;
  if (!DICE_NODE_ID_RE.test(nodeId) || !notation) return false;

  const element = target.ownerDocument!.createElement("span");
  element.setAttribute("data-type", DICE_INLINE_NODE_NAME);
  element.setAttribute("data-node-id", nodeId.toLowerCase());
  element.setAttribute("data-notation", notation);
  element.textContent = source.textContent?.trim() || formatInlineDicePending(notation);
  target.appendChild(element);
  return true;
}

function appendEditorImage(source: Element, target: Node): boolean {
  const src = source.getAttribute("src") ?? "";
  if (!isSafeHref(src, true)) return false;
  const document = target.ownerDocument!;
  const image = document.createElement("img");
  const dataType = source.getAttribute("data-type");

  if (dataType === STICKER_INLINE_NODE_NAME) {
    const assetId = source.getAttribute("data-asset-id") ?? "";
    if (!STICKER_ASSET_ID_RE.test(assetId)) return false;
    image.setAttribute("data-type", STICKER_INLINE_NODE_NAME);
    image.setAttribute("data-asset-id", assetId);
    image.setAttribute("src", src);
    image.setAttribute("alt", source.getAttribute("alt") || "表情");
    target.appendChild(image);
    return true;
  }

  if (dataType === "image-block") {
    const ratio = Number(source.getAttribute("ratio") ?? "1");
    image.setAttribute("data-type", "image-block");
    image.setAttribute("src", src);
    const caption = (source.getAttribute("caption") ?? "").slice(0, 512);
    const normalizedRatio = Number.isFinite(ratio) && ratio > 0 ? ratio : 1;
    image.setAttribute("caption", caption);
    image.setAttribute("ratio", String(normalizedRatio));
    target.appendChild(image);
    return true;
  }

  image.setAttribute("src", src);
  image.setAttribute("alt", (source.getAttribute("alt") ?? "").slice(0, 512));
  const title = source.getAttribute("title");
  if (title) image.setAttribute("title", title.slice(0, 512));
  target.appendChild(image);
  return true;
}

function containsProjectedRegularImage(source: Element): boolean {
  return [source, ...source.querySelectorAll("img, [data-wenyou-clipboard-media]")]
    .some((element) => {
      const media = element.getAttribute(SITE_CLIPBOARD_MEDIA_ATTRIBUTE);
      if (media === "image") return true;
      if (element.tagName.toUpperCase() !== "IMG") return false;
      return media !== "sticker"
        && element.getAttribute("data-type") !== STICKER_INLINE_NODE_NAME;
    });
}

function appendNormalizedNode(
  source: Node,
  target: Node,
  clipboardSource: SiteClipboardSource,
  preserveAlignment: boolean,
) {
  const document = target.ownerDocument!;
  if (source.nodeType === Node.TEXT_NODE) {
    target.appendChild(document.createTextNode(source.textContent ?? ""));
    return;
  }
  if (source.nodeType !== Node.ELEMENT_NODE) return;

  const element = source as Element;
  const tagName = element.tagName.toUpperCase();
  const media = element.getAttribute(SITE_CLIPBOARD_MEDIA_ATTRIBUTE);
  if (
    clipboardSource === "reader"
    && (media === "image" || media === "sticker" || tagName === "IMG")
  ) {
    target.appendChild(document.createTextNode(media === "sticker" ? "[表情]" : "[图片]"));
    return;
  }

  if (
    element.hasAttribute("data-dice-node-id")
    || element.getAttribute("data-type") === DICE_INLINE_NODE_NAME
  ) {
    if (!appendDiceNode(element, target)) {
      target.appendChild(document.createTextNode(element.textContent ?? ""));
    }
    return;
  }

  if (tagName === "IMG") {
    if (clipboardSource !== "editor" || !appendEditorImage(element, target)) {
      target.appendChild(document.createTextNode("[图片]"));
    }
    return;
  }

  if (DROP_CONTENT_TAGS.has(tagName)) return;

  if (tagName === "A") {
    const href = element.getAttribute("href") ?? "";
    if (!isSafeHref(href)) {
      appendChildren(element, target, clipboardSource, preserveAlignment);
      return;
    }
    const anchor = document.createElement("a");
    anchor.setAttribute("href", href);
    appendChildren(element, anchor, clipboardSource, preserveAlignment);
    target.appendChild(anchor);
    return;
  }

  const normalizedTag = (() => {
    switch (tagName) {
      case "B":
      case "STRONG":
        return "strong";
      case "I":
      case "EM":
        return "em";
      case "S":
      case "STRIKE":
      case "DEL":
        return "del";
      case "CODE":
        return "code";
      case "P":
        return "p";
      case "H2":
        return "h2";
      case "H3":
        return "h3";
      case "BLOCKQUOTE":
        return "blockquote";
      case "UL":
        return "ul";
      case "OL":
        return "ol";
      case "LI":
        return "li";
      case "BR":
        return "br";
      case "HR":
        return "hr";
      default:
        return null;
    }
  })();

  if (!normalizedTag) {
    appendChildren(element, target, clipboardSource, preserveAlignment);
    return;
  }

  const normalized = document.createElement(normalizedTag);
  if (normalizedTag === "ol") {
    const start = Number(element.getAttribute("start") ?? "1");
    if (Number.isInteger(start) && start > 1 && start <= 1_000_000) {
      normalized.setAttribute("start", String(start));
    }
  }
  if (normalizedTag !== "br" && normalizedTag !== "hr") {
    appendChildren(element, normalized, clipboardSource, preserveAlignment);
  }
  const alignment = element.getAttribute(WENYOU_ALIGNMENT_ATTRIBUTE);
  const topLevelEligible =
    target.nodeType === Node.ELEMENT_NODE
    && (target as Element).hasAttribute(SITE_CLIPBOARD_VERSION_ATTRIBUTE)
    && (normalizedTag === "p" || normalizedTag === "h2" || normalizedTag === "h3");
  const hasRegularImage = containsProjectedRegularImage(element)
    || Array.from(normalized.querySelectorAll("img")).some(
      (image) => image.getAttribute("data-type") !== STICKER_INLINE_NODE_NAME,
    );
  const hasAlignableContent = Boolean(
    normalized.textContent?.trim()
    || normalized.querySelector(`img[data-type="${STICKER_INLINE_NODE_NAME}"]`),
  );
  if (
    preserveAlignment
    && topLevelEligible
    && isStoredWenyouTextAlignment(alignment)
    && hasAlignableContent
    && !hasRegularImage
  ) {
    normalized.setAttribute(WENYOU_ALIGNMENT_ATTRIBUTE, alignment);
  }
  target.appendChild(normalized);
}

export function createSiteClipboardEnvelope(
  nodes: Iterable<Node>,
  source: SiteClipboardSource,
  document: Document = window.document,
  preserveAlignment = true,
): HTMLElement {
  const envelope = document.createElement("div");
  envelope.setAttribute(SITE_CLIPBOARD_VERSION_ATTRIBUTE, SITE_CLIPBOARD_VERSION);
  envelope.setAttribute(SITE_CLIPBOARD_SOURCE_ATTRIBUTE, source);
  for (const node of Array.from(nodes)) {
    appendNormalizedNode(node, envelope, source, preserveAlignment);
  }
  return envelope;
}

function appendProjectedText(node: Node, output: string[]): void {
  if (node.nodeType === Node.TEXT_NODE) {
    output.push(node.textContent ?? "");
    return;
  }
  if (node.nodeType !== Node.ELEMENT_NODE) return;
  const element = node as Element;
  const tagName = element.tagName.toUpperCase();

  if (tagName === "BR") {
    output.push("\n");
    return;
  }
  if (tagName === "HR") {
    output.push("\n\n");
    return;
  }
  if (tagName === "IMG") {
    const label = element.getAttribute("data-type") === STICKER_INLINE_NODE_NAME
      ? "[表情]"
      : "[图片]";
    if (element.getAttribute("data-type") === "image-block") {
      output.push(`\n\n${label}\n\n`);
    } else {
      output.push(label);
    }
    return;
  }
  if (tagName === "LI") {
    const parent = element.parentElement;
    if (parent?.tagName === "OL") {
      const siblings = Array.from(parent.children).filter((child) => child.tagName === "LI");
      const start = Number(parent.getAttribute("start") ?? "1");
      output.push(`${start + Math.max(0, siblings.indexOf(element))}. `);
    } else {
      output.push("• ");
    }
    for (const child of Array.from(element.childNodes)) {
      if (
        child.nodeType === Node.ELEMENT_NODE
        && (child as Element).tagName.toUpperCase() === "P"
      ) {
        for (const paragraphChild of Array.from(child.childNodes)) {
          appendProjectedText(paragraphChild, output);
        }
      } else {
        appendProjectedText(child, output);
      }
    }
    output.push("\n");
    return;
  }

  for (const child of Array.from(element.childNodes)) appendProjectedText(child, output);
  if (BLOCK_TAGS.has(tagName)) output.push("\n\n");
  if (tagName === "UL" || tagName === "OL") output.push("\n");
}

export function projectSiteClipboardText(root: Node): string {
  const output: string[] = [];
  appendProjectedText(root, output);
  return output
    .join("")
    .replace(/\r\n?/gu, "\n")
    .replace(/[\t ]+\n/gu, "\n")
    .replace(/\n{3,}/gu, "\n\n")
    .trim();
}

export function createSiteClipboardPayloadFromNodes(
  nodes: Iterable<Node>,
  source: SiteClipboardSource,
  document: Document = window.document,
  preserveAlignment = true,
): SiteClipboardPayload {
  const envelope = createSiteClipboardEnvelope(
    nodes,
    source,
    document,
    preserveAlignment,
  );
  return {
    source,
    html: envelope.outerHTML,
    text: projectSiteClipboardText(envelope),
  };
}

export function createReaderClipboardPayload(root: HTMLElement): SiteClipboardPayload {
  return createSiteClipboardPayloadFromNodes(root.childNodes, "reader", root.ownerDocument);
}

function closestAtomicReaderNode(root: HTMLElement, node: Node): Element | null {
  const element = node.nodeType === Node.ELEMENT_NODE
    ? node as Element
    : node.parentElement;
  const atomic = element?.closest(ATOMIC_READER_SELECTOR) ?? null;
  return atomic && root.contains(atomic) ? atomic : null;
}

function restoreSharedSelectionAncestors(
  root: HTMLElement,
  range: Range,
  fragment: DocumentFragment,
) {
  let ancestor = range.commonAncestorContainer.nodeType === Node.ELEMENT_NODE
    ? range.commonAncestorContainer as Element
    : range.commonAncestorContainer.parentElement;
  let wrapped: Node = fragment;
  while (ancestor && ancestor !== root) {
    const tagName = ancestor.tagName.toUpperCase();
    const alignment = ancestor.getAttribute(WENYOU_ALIGNMENT_ATTRIBUTE);
    const alignedBlock = (tagName === "P" || tagName === "H2" || tagName === "H3")
      && isStoredWenyouTextAlignment(alignment);
    if (INLINE_SELECTION_WRAPPER_TAGS.has(tagName) || alignedBlock) {
      const wrapper = ancestor.cloneNode(false) as Element;
      wrapper.appendChild(wrapped);
      wrapped = wrapper;
    }
    ancestor = ancestor.parentElement;
  }
  if (wrapped !== fragment) fragment.appendChild(wrapped);
}

export function createReaderSelectionClipboardPayload(
  root: HTMLElement,
  selection: Selection | null = window.getSelection(),
): SiteClipboardPayload | null {
  if (!selection || selection.rangeCount !== 1 || selection.isCollapsed) return null;
  const original = selection.getRangeAt(0);
  if (!root.contains(original.startContainer) || !root.contains(original.endContainer)) return null;

  const range = original.cloneRange();
  const startAtomic = closestAtomicReaderNode(root, range.startContainer);
  const endAtomic = closestAtomicReaderNode(root, range.endContainer);
  try {
    if (startAtomic) range.setStartBefore(startAtomic);
    if (endAtomic) range.setEndAfter(endAtomic);
  } catch {
    return null;
  }
  const fragment = range.cloneContents();
  restoreSharedSelectionAncestors(root, range, fragment);
  return createSiteClipboardPayloadFromNodes(fragment.childNodes, "reader", root.ownerDocument);
}

export function parseSiteClipboardHtml(html: string): SiteClipboardPayload | null {
  if (!html || html.length > 1_000_000) return null;
  const template = document.createElement("template");
  template.innerHTML = html;
  const envelopes = template.content.querySelectorAll(`[${SITE_CLIPBOARD_VERSION_ATTRIBUTE}]`);
  if (envelopes.length !== 1) return null;
  const envelope = envelopes[0]!;
  const source = envelope.getAttribute(SITE_CLIPBOARD_SOURCE_ATTRIBUTE);
  const version = envelope.getAttribute(SITE_CLIPBOARD_VERSION_ATTRIBUTE);
  if (
    (version !== "1" && version !== SITE_CLIPBOARD_VERSION)
    || (source !== "reader" && source !== "editor")
  ) {
    return null;
  }
  return createSiteClipboardPayloadFromNodes(
    envelope.childNodes,
    source,
    envelope.ownerDocument,
    version === SITE_CLIPBOARD_VERSION,
  );
}

export function setSiteClipboardData(
  clipboard: Pick<DataTransfer, "setData">,
  payload: SiteClipboardPayload,
) {
  clipboard.setData("text/html", payload.html);
  clipboard.setData("text/plain", payload.text);
}

export async function writeSiteClipboardPayload(payload: SiteClipboardPayload): Promise<void> {
  const clipboard = navigator.clipboard;
  if (!clipboard) throw new Error("Clipboard API unavailable");

  if (clipboard.write && typeof ClipboardItem !== "undefined") {
    try {
      await clipboard.write([
        new ClipboardItem({
          "text/html": new Blob([payload.html], { type: "text/html" }),
          "text/plain": new Blob([payload.text], { type: "text/plain" }),
        }),
      ]);
      return;
    } catch {
      // 浏览器或系统剪贴板不支持富格式时，保留可见文字回退。
    }
  }
  if (!clipboard.writeText) throw new Error("Clipboard text API unavailable");
  await clipboard.writeText(payload.text);
}
