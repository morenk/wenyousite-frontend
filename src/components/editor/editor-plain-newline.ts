import { Fragment, type Node as ProseNode } from "@milkdown/kit/prose/model";
import type { EditorView } from "@milkdown/kit/prose/view";

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
  const type = state.schema.nodes.hardbreak;
  if (!type) return false;
  const marks = state.storedMarks ?? $from.marks();
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
  for (let index = 0; index < lines.length; index++) {
    // Milkdown emits an HTML placeholder for a new empty list item; keep
    // the standard empty item syntax so the existing list keymap can continue.
    const line = lines[index]!.replace(/^( {0,6}(?:[-+*]|\d+[.)]))[\t ]+<br \/>$/, "$1 ");
    const marker = line === "" ? "<br />" : line === ">" ? "> <br />" : null;
    if (marker !== null && (lines[index - 1] === marker || lines[index + 1] === marker)) continue;
    // An empty quote scaffold remains compatible with the existing empty quote.
    if (line === "> <br />" && !lines[index - 1]?.startsWith(">")
      && !lines[index + 1]?.startsWith(">")) output.push(">");
    else output.push(line);
  }
  return output.join("\n");
}
