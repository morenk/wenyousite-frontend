import { Fragment, type Node as ProseNode } from "@milkdown/kit/prose/model";
import type { EditorView } from "@milkdown/kit/prose/view";
import { analyzeMarkdownBlockBoundaries } from "@/lib/markdown-block-boundaries";
import { AUTO_TRAILING_PARAGRAPH } from "./editor-trailing-paragraph";

/** Only ordinary text and one quote follow the product's literal Enter rule. */
export function handlePlainNewline(view: EditorView, event: KeyboardEvent): boolean {
  if (event.key !== "Enter" || event.isComposing || view.composing
    || event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) return false;
  const { state } = view;
  const { $from } = state.selection;
  if ($from.parent.type.name !== "paragraph") return false;
  for (let depth = 1; depth < $from.depth; depth++) {
    if ($from.node(depth).type.name !== "blockquote") return false;
  }
  if ($from.depth > 2) return false;
  const marks = state.storedMarks ?? $from.marks();
  if ($from.depth === 1) {
    // 手动换行独立对齐；自动折行不生成事务。
    const tr = state.tr.deleteSelection();
    const { $from: insertion } = tr.selection;
    // 在同一事务清除新空段的对齐，避免后续清理事务丢失 stored marks。
    if (insertion.parentOffset === 0 || insertion.parent.attrs[AUTO_TRAILING_PARAGRAPH]) {
      tr.setNodeMarkup(insertion.before(1), undefined, { ...insertion.parent.attrs, textAlign: "left", [AUTO_TRAILING_PARAGRAPH]: false });
    }
    tr.split(insertion.pos, 1, [{ type: insertion.parent.type,
      attrs: { ...insertion.parent.attrs, textAlign: "left", [AUTO_TRAILING_PARAGRAPH]: false } }]);
    view.dispatch(tr.setStoredMarks(marks).scrollIntoView());
    return true;
  }
  const type = state.schema.nodes.hardbreak;
  if (!type) return false;
  view.dispatch(state.tr.replaceSelectionWith(type.create(), false)
    .setStoredMarks(marks).scrollIntoView());
  return true;
}

/** Keep soft LF inside text; serialize truly empty rows as explicit protocol nodes. */
export function documentWithExplicitEmptyRows(doc: ProseNode): ProseNode {
  function paragraphRows(node: ProseNode): ProseNode[] {
    const rows: ProseNode[][] = [[]];
    node.forEach((child) => {
      if (child.type.name === "hardbreak") rows.push([]);
      else rows.at(-1)!.push(child);
    });
    if (rows.length === 1 || rows.every((row) => row.length > 0)) return [node];
    const output: ProseNode[] = [];
    let content: ProseNode[] = [];
    const flush = () => {
      if (content.length === 0) return;
      output.push(node.type.create(node.attrs, content, node.marks));
      content = [];
    };
    for (const row of rows) {
      if (row.length === 0) {
        flush();
        output.push(node.type.create({ ...node.attrs, textAlign: null }, null, node.marks));
      } else {
        if (content.length > 0) content.push(node.type.schema.nodes.hardbreak!.create());
        content.push(...row);
      }
    }
    flush();
    return output;
  }
  function visit(container: ProseNode): ProseNode {
    const children: ProseNode[] = [];
    container.forEach((child) => {
      if (child.type.name === "paragraph") children.push(...paragraphRows(child));
      else if (container === doc && child.type.name === "blockquote") children.push(visit(child));
      else children.push(child);
    });
    return container.copy(Fragment.fromArray(children));
  }
  return visit(doc);
}

/** Remove only parser separators around explicit empty-row markers. */
export function canonicalizeEditorEmptyRows(markdown: string): string {
  const lines = markdown.split("\n");
  const output: string[] = [];
  // 保留结构块与其后作者空段之间的解析分隔；否则列表会将 <br /> 和正文吞作同一项。
  const separators = new Set<number>();
  const roots = analyzeMarkdownBlockBoundaries(markdown).tokens.filter((token) => token.level === 0 && token.map);
  for (let index = 1; index < roots.length; index++) {
    const row = roots[index]!;
    const previous = roots[index - 1]!;
    if (!row.meta?.emptyRow || previous.meta?.emptyRow || previous.type === "paragraph_open" || previous.type === "inline") continue;
    for (let line = previous.map![1] - 1; line < row.map![0]; line++) {
      if (lines[line] === "") separators.add(line);
    }
  }
  for (let index = 0; index < lines.length; index++) {
    const line = lines[index]!;
    const marker = line === "" ? "<br />" : line === ">" ? "> <br />" : null;
    if (!separators.has(index) && marker !== null && (lines[index - 1] === marker || lines[index + 1] === marker)) continue;
    // An empty quote scaffold remains compatible with the existing empty quote.
    if (line === "> <br />" && !lines[index - 1]?.startsWith(">")
      && !lines[index + 1]?.startsWith(">")) output.push(">");
    else output.push(line);
  }
  return output.join("\n");
}
