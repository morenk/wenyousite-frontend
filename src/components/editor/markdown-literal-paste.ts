import { editorViewOptionsCtx, schemaCtx } from "@milkdown/core";
import {
  DOMParser,
  DOMSerializer,
  Fragment,
  type ParseRule,
  Slice,
  type Schema,
} from "@milkdown/kit/prose/model";
import { Plugin, TextSelection } from "@milkdown/kit/prose/state";
import type { EditorView } from "@milkdown/kit/prose/view";
import { $prose } from "@milkdown/kit/utils";
import { handleInternalReferenceUrlPaste } from "@/components/shared/internal-reference-editor-dom";
import {
  createSiteClipboardEnvelope,
  createSiteClipboardPayloadFromNodes,
  parseSiteClipboardHtml,
} from "@/lib/site-clipboard";
import { STICKER_INLINE_NODE_NAME } from "@/lib/sticker-inline";

const BLOCK_TAGS = new Set([
  "ADDRESS", "ARTICLE", "ASIDE", "BLOCKQUOTE", "DIV", "FIGCAPTION", "FIGURE",
  "FOOTER", "HEADER", "H1", "H2", "H3", "H4", "H5", "H6", "LI", "MAIN",
  "NAV", "OL", "P", "PRE", "SECTION", "TABLE", "TR", "UL",
]);
const NON_VISIBLE_HTML_TAGS = new Set([
  "HEAD", "NOSCRIPT", "SCRIPT", "STYLE", "SVG", "TEMPLATE",
]);

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
    if (NON_VISIBLE_HTML_TAGS.has(node.tagName)) return;
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

function createLiteralSlice(view: EditorView, text: string): Slice | null {
  const paragraph = view.state.schema.nodes.paragraph;
  if (!paragraph || !text) return null;
  const nodes = text.replace(/\r\n?/g, "\n").split("\n").map((line) =>
    paragraph.create(null, line ? view.state.schema.text(line) : undefined),
  );
  return new Slice(Fragment.fromArray(nodes), 0, 0);
}

function setSelectionNear(view: EditorView, position: number) {
  const clamped = Math.max(0, Math.min(position, view.state.doc.content.size));
  const selection = TextSelection.near(view.state.doc.resolve(clamped));
  if (!selection.eq(view.state.selection)) view.dispatch(view.state.tr.setSelection(selection));
}

export function insertLiteralClipboardText(
  view: EditorView,
  text: string,
  position?: number,
): boolean {
  if (position !== undefined) setSelectionNear(view, position);
  const slice = createLiteralSlice(view, text);
  if (!slice) return false;
  view.dispatch(view.state.tr.replaceSelection(slice).scrollIntoView());
  return true;
}

function finishHandledClipboardEvent(event: ClipboardEvent | DragEvent) {
  event.preventDefault();
  event.stopImmediatePropagation();
}

function pasteEditorSiteFragment(view: EditorView, html: string): boolean {
  const template = document.createElement("template");
  template.innerHTML = html;
  const envelope = template.content.firstElementChild;
  if (!envelope) return false;
  if (!view.state.schema.nodes["image-block"]) {
    envelope.querySelectorAll('img[data-type="image-block"]').forEach((image) => {
      image.replaceWith(document.createTextNode("[图片]"));
    });
  }
  if (!view.state.schema.nodes[STICKER_INLINE_NODE_NAME]) {
    envelope.querySelectorAll(`img[data-type="${STICKER_INLINE_NODE_NAME}"]`).forEach((image) => {
      image.replaceWith(document.createTextNode("[表情]"));
    });
  }
  let slice = createEditorClipboardParser(view.state.schema).parseSlice(envelope, {
    preserveWhitespace: true,
    context: view.state.selection.$from,
  });
  view.someProp("transformPasted", (transform) => {
    slice = transform(slice, view, false);
  });
  if (slice.size === 0) return false;
  view.dispatch(
    view.state.tr
      .replaceSelection(slice)
      .scrollIntoView()
      .setMeta("paste", true)
      .setMeta("uiEvent", "paste"),
  );
  return true;
}

function handleSiteFragmentPaste(view: EditorView, event: ClipboardEvent): boolean {
  const html = event.clipboardData?.getData("text/html") ?? "";
  const payload = parseSiteClipboardHtml(html);
  if (!payload) return false;
  const pasted = payload.source === "editor"
    ? pasteEditorSiteFragment(view, payload.html)
    : view.pasteHTML(payload.html, event);
  if (!pasted) return false;
  finishHandledClipboardEvent(event);
  view.focus();
  return true;
}

/** 无本站 v1 envelope 的内容一律按系统可见文字插入。 */
export function handleLiteralClipboardPaste(view: EditorView, event: ClipboardEvent): boolean {
  const clipboard = event.clipboardData;
  if (!clipboard) return false;
  if (clipboard.files?.length) {
    finishHandledClipboardEvent(event);
    return true;
  }
  const plain = clipboard.getData("text/plain");
  const html = clipboard.getData("text/html");
  const text = plain || extractClipboardHtmlText(html);
  if (!text) {
    if (!html) return false;
    finishHandledClipboardEvent(event);
    return true;
  }
  if (!insertLiteralClipboardText(view, text)) return false;
  finishHandledClipboardEvent(event);
  view.focus();
  return true;
}

function handleExternalDrop(view: EditorView, event: DragEvent): boolean {
  if (view.dragging) return false;
  const transfer = event.dataTransfer;
  if (!transfer) return false;
  if (transfer.files.length > 0) {
    finishHandledClipboardEvent(event);
    return true;
  }

  const plain = transfer.getData("text/plain");
  const html = transfer.getData("text/html");
  const text = plain || extractClipboardHtmlText(html);
  if (!text) {
    if (!html) return false;
    finishHandledClipboardEvent(event);
    return true;
  }
  const position = view.posAtCoords({ left: event.clientX, top: event.clientY })?.pos
    ?? view.state.selection.from;
  setSelectionNear(view, position);

  const handled = insertLiteralClipboardText(view, text);
  if (!handled) return false;
  finishHandledClipboardEvent(event);
  view.focus();
  return true;
}

function createEditorClipboardSerializer(schema: Schema): DOMSerializer {
  const base = DOMSerializer.fromSchema(schema);
  return new class extends DOMSerializer {
    constructor() {
      super(base.nodes, base.marks);
    }

    override serializeFragment(
      fragment: Fragment,
      options: { document?: Document } = {},
      target?: HTMLElement | DocumentFragment,
    ) {
      const clipboardDocument = options.document ?? document;
      const serialized = base.serializeFragment(fragment, { document: clipboardDocument });
      const envelope = createSiteClipboardEnvelope(
        serialized.childNodes,
        "editor",
        clipboardDocument,
      );
      const output = target ?? clipboardDocument.createDocumentFragment();
      output.appendChild(envelope);
      return output;
    }
  }();
}

function createEditorClipboardParser(schema: Schema): DOMParser {
  const base = DOMParser.fromSchema(schema);
  const rules: ParseRule[] = [];
  const imageBlockType = schema.nodes["image-block"];
  const stickerType = schema.nodes[STICKER_INLINE_NODE_NAME];
  if (stickerType) {
    rules.push({
      tag: `img[data-type="${STICKER_INLINE_NODE_NAME}"]`,
      node: stickerType.name,
      priority: 1_000,
      getAttrs: (element) => ({
        assetId: element.getAttribute("data-asset-id") ?? "",
        src: element.getAttribute("src") ?? "",
        alt: element.getAttribute("alt") ?? "表情",
      }),
    });
  }
  if (imageBlockType) {
    rules.push({
      tag: 'img[data-type="image-block"]',
      node: imageBlockType.name,
      priority: 1_000,
      getAttrs: (element) => ({
        src: element.getAttribute("src") ?? "",
        caption: element.getAttribute("caption") ?? "",
        ratio: Number(element.getAttribute("ratio") ?? "1"),
      }),
    });
  }
  return new DOMParser(schema, [...rules, ...base.rules]);
}

/** 所有复制、粘贴与外部拖放事务统一从 ProseMirror 插件入口进入文档。 */
export const editorMarkdownPastePlugin = $prose((ctx) => {
  const schema = ctx.get(schemaCtx);
  const baseSerializer = DOMSerializer.fromSchema(schema);
  ctx.update(editorViewOptionsCtx, (options) => ({
    ...options,
    clipboardSerializer: createEditorClipboardSerializer(schema),
    clipboardTextSerializer: (slice) => {
      const serialized = baseSerializer.serializeFragment(slice.content, { document });
      return createSiteClipboardPayloadFromNodes(
        serialized.childNodes,
        "editor",
        document,
      ).text;
    },
  }));

  return new Plugin({
    props: {
      handleDOMEvents: {
        paste: (view, event) => {
          if (event.clipboardData?.files?.length) {
            return handleLiteralClipboardPaste(view, event);
          }
          if (handleSiteFragmentPaste(view, event)) return true;
          if (handleInternalReferenceUrlPaste(view, event)) {
            view.focus();
            return true;
          }
          return handleLiteralClipboardPaste(view, event);
        },
        drop: handleExternalDrop,
      },
    },
  });
});
