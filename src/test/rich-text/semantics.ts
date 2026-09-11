import { withoutAutomaticTrailingParagraph } from "@/components/editor/editor-trailing-paragraph";
import type { Node as ProseNode, ResolvedPos } from "@milkdown/kit/prose/model";
import { documentWithExplicitEmptyRows } from "@/components/editor/editor-plain-newline";

export interface Position { path: number[]; offset: number }
export interface SharedSelection { anchor: Position; focus: Position }
export interface SharedState {
  canonical?: string | null;
  summary?: { blocks: unknown[] };
  selection?: SharedSelection;
  save?: { target?: string; requestMarkdown: string | null; persistedMarkdown: string; dirty: boolean };
  navigation?: string;
}

function inline(node: ProseNode): unknown {
  if (node.type.name === "hardbreak") return { type: "softBreak" };
  if (node.type.name === "dice_inline") return { type: "dice", nodeId: node.attrs.nodeId, notation: node.attrs.notation };
  if (node.type.name === "sticker-inline") return { type: "sticker", assetId: node.attrs.assetId, url: node.attrs.src, alt: node.attrs.alt };
  if (!node.isText) throw new Error(`Unmapped inline type: ${node.type.name}`);
  const marks: Record<string, unknown> = {};
  for (const mark of node.marks) {
    const type = mark.type.name;
    if (type === "link") {
      const user = /^\/users\/([^/]+)$/u.exec(String(mark.attrs.href));
      if (user && node.text?.startsWith("@")) return { type: "mention", userId: user[1], label: node.text };
      marks.link = mark.attrs.href;
    } else {
      const key = ({ strong: "bold", emphasis: "italic", strike_through: "strikethrough", inlineCode: "code" } as Record<string, string>)[type];
      if (!key) throw new Error(`Unmapped mark type: ${type}`);
      marks[key] = true;
    }
  }
  return { type: "text", text: node.text, marks };
}
function block(node: ProseNode): unknown {
  const children: unknown[] = [];
  if (node.type.name === "blockquote") {
    node.forEach((child) => children.push(block(child)));
    return { type: "blockquote", children };
  }
  if (["paragraph", "heading"].includes(node.type.name)) {
    node.forEach((child) => children.push(inline(child)));
    return { type: node.type.name, ...(node.type.name === "heading" ? { level: node.attrs.level } : {}),
      alignment: node.attrs.textAlign || "left", children };
  }
  throw new Error(`Unmapped block type: ${node.type.name}`);
}
export function summarizeDocument(doc: ProseNode) {
  const blocks: unknown[] = [];
  documentWithExplicitEmptyRows(withoutAutomaticTrailingParagraph(doc)).forEach((node) => blocks.push(block(node)));
  return { blocks };
}
function logicalWidth(node: ProseNode) {
  if (node.isText && node.marks.some((mark) => mark.type.name === "link" && /^\/users\//u.test(String(mark.attrs.href))) && node.text?.startsWith("@")) return 1;
  return node.isText ? node.nodeSize : 1;
}
export function resolvePosition(doc: ProseNode, position: Position) {
  let container = doc;
  let start = 0;
  for (const index of position.path) {
    if (index < 0 || index >= container.childCount) throw new Error("Invalid block path");
    for (let sibling = 0; sibling < index; sibling++) start += container.child(sibling).nodeSize;
    container = container.child(index);
    start++;
  }
  if (!container.isTextblock) throw new Error("Selection must target a text block");
  let remaining = position.offset;
  let result = start;
  container.forEach((child) => {
    if (remaining <= 0) return;
    const width = logicalWidth(child);
    const consumed = Math.min(width, remaining);
    result += width === child.nodeSize ? consumed : child.nodeSize;
    remaining -= consumed;
  });
  if (remaining !== 0) throw new Error("Invalid UTF-16 offset");
  return result;
}
function sharedPosition(position: ResolvedPos): Position {
  const path = Array.from({ length: position.depth }, (_, depth) => position.index(depth));
  let offset = 0;
  let remaining = position.parentOffset;
  position.parent.forEach((child) => {
    const consumed = Math.min(remaining, child.nodeSize);
    if (consumed > 0) offset += logicalWidth(child) === child.nodeSize ? consumed : 1;
    remaining -= consumed;
  });
  return { path, offset };
}
export function summarizeSelection(selection: { $anchor: ResolvedPos; $head: ResolvedPos }): SharedSelection {
  return { anchor: sharedPosition(selection.$anchor), focus: sharedPosition(selection.$head) };
}
/** 默认差异只返回字段路径，不回显正文和身份。 */
export function firstDifference(expected: unknown, actual: unknown, path = "$"): string | undefined {
  if (Object.is(expected, actual)) return undefined;
  if (!expected || !actual || typeof expected !== "object" || typeof actual !== "object") return path;
  if (Array.isArray(expected) !== Array.isArray(actual)) return path;
  const left = expected as Record<string, unknown>, right = actual as Record<string, unknown>;
  for (const key of [...new Set([...Object.keys(left), ...Object.keys(right)])]) {
    if (!(key in left) || !(key in right)) return `${path}.${key}`;
    const difference = firstDifference(left[key], right[key], `${path}.${key}`);
    if (difference) return difference;
  }
}
