import type { Mark } from "@milkdown/kit/prose/model";
import type { Transaction } from "@milkdown/kit/prose/state";
import type { EditorView, MarkView } from "@milkdown/kit/prose/view";
import {
  INTERNAL_REFERENCE_DEFAULT_LABEL,
  parseInternalReference,
} from "@/lib/internal-reference";

function setLinkAttributes(dom: HTMLAnchorElement, mark: Mark) {
  const href = String(mark.attrs.href ?? "");
  const reference = parseInternalReference(href);
  dom.setAttribute("href", reference?.href ?? href);
  const title = typeof mark.attrs.title === "string" ? mark.attrs.title : null;
  if (title) dom.setAttribute("title", title);
  else dom.removeAttribute("title");
  return reference;
}

function createDoorOpenIcon() {
  const namespace = "http://www.w3.org/2000/svg";
  const icon = document.createElementNS(namespace, "svg");
  icon.dataset.slot = "internal-reference-icon";
  icon.setAttribute("viewBox", "0 0 24 24");
  icon.setAttribute("fill", "none");
  icon.setAttribute("stroke", "currentColor");
  icon.setAttribute("stroke-width", "2");
  icon.setAttribute("stroke-linecap", "round");
  icon.setAttribute("stroke-linejoin", "round");
  icon.setAttribute("aria-hidden", "true");
  for (const data of [
    "M13 4h3a2 2 0 0 1 2 2v14",
    "M2 20h3",
    "M13 20h9",
    "M10 12v.01",
    "M13 4.562v16.157a1 1 0 0 1-1.242.97L5 20V5.562a2 2 0 0 1 1.515-1.94l4-1A2 2 0 0 1 13 4.561Z",
  ]) {
    const path = document.createElementNS(namespace, "path");
    path.setAttribute("d", data);
    icon.append(path);
  }
  return icon;
}

/** 编辑态链接视图：站内坐标呈现为传送门，但点击只用于编辑，不触发导航。 */
export function createEditorLinkMarkView(initialMark: Mark): MarkView {
  const dom = document.createElement("a");
  let mark = initialMark;
  const reference = setLinkAttributes(dom, mark);

  if (!reference) {
    return {
      dom,
      contentDOM: dom,
      update(nextMark) {
        if (nextMark.type !== mark.type || parseInternalReference(String(nextMark.attrs.href ?? ""))) {
          return false;
        }
        mark = nextMark;
        setLinkAttributes(dom, mark);
        return true;
      },
    };
  }

  dom.dataset.slot = "internal-reference-link";
  dom.dataset.editorLink = "true";
  const prefix = document.createElement("span");
  prefix.dataset.slot = "internal-reference-prefix";
  prefix.textContent = "站内传送门：";
  const icon = createDoorOpenIcon();
  const contentDOM = document.createElement("span");
  contentDOM.dataset.slot = "internal-reference-label";
  dom.append(prefix, icon, contentDOM);
  dom.addEventListener("click", (event) => event.preventDefault());

  return {
    dom,
    contentDOM,
    update(nextMark) {
      const nextReference = nextMark.type === mark.type
        ? parseInternalReference(String(nextMark.attrs.href ?? ""))
        : null;
      if (!nextReference) return false;
      mark = nextMark;
      setLinkAttributes(dom, mark);
      return true;
    },
  };
}

export interface InternalReferenceTransactionOptions {
  label?: string;
  canApply?: (transaction: Transaction) => boolean;
}

/** 用标准 link mark 替换当前选区，确保 Milkdown 仍按普通 Markdown 链接序列化。 */
export function insertInternalReferenceAtSelection(
  view: EditorView,
  href: string,
  options: InternalReferenceTransactionOptions = {},
): boolean {
  const reference = parseInternalReference(href);
  const link = view.state.schema.marks.link;
  if (!reference || !link) return false;
  const { from, to } = view.state.selection;
  const selectedText = view.state.doc.textBetween(from, to, " ").trim();
  const label = options.label?.trim() || selectedText || INTERNAL_REFERENCE_DEFAULT_LABEL;
  const text = view.state.schema.text(label, [link.create({ href: reference.href, title: null })]);
  const transaction = view.state.tr
    .replaceSelectionWith(text, false)
    .removeStoredMark(link)
    .scrollIntoView();
  if (options.canApply && !options.canApply(transaction)) return false;
  view.dispatch(transaction);
  return true;
}

/** 只接管剪贴板整体为一个合法站内地址的情况；混合文本继续走原粘贴链路。 */
export function handleInternalReferenceUrlPaste(
  view: EditorView,
  event: ClipboardEvent,
  options: InternalReferenceTransactionOptions = {},
): boolean {
  const plain = event.clipboardData?.getData("text/plain") ?? "";
  const href = plain.trim();
  if (!href || !parseInternalReference(href)) return false;
  if (!insertInternalReferenceAtSelection(view, href, options)) return false;
  event.preventDefault();
  event.stopImmediatePropagation();
  return true;
}
