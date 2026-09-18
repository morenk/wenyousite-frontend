import { readFileSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import MarkdownIt from "markdown-it";
import { resolve } from "node:path";
import { CrepeBuilder } from "@milkdown/crepe/builder";
import { imageBlock } from "@milkdown/crepe/feature/image-block";
import { commandsCtx, editorViewCtx, parserCtx } from "@milkdown/core";
import { toggleInlineCodeCommand } from "@milkdown/kit/preset/commonmark";
import { undo, redo, closeHistory } from "@milkdown/kit/prose/history";
import { TextSelection } from "@milkdown/kit/prose/state";
import type { Ctx } from "@milkdown/kit/ctx";
import type { Node as ProseNode } from "@milkdown/kit/prose/model";
import { afterAll, describe, expect, test } from "vitest";
import {
  configureEditorMarkdownSerializer,
  createEditorMarkdownBridge,
  editorAttentionBoundaryParser,
  editorBoundaryTextSchema,
  editorSoftBreakParser,
  prepareEditorMarkdown,
  serializeEditorMarkdown,
} from "@/components/editor/milkdown-markdown-codec";
import {
  configureEditorAlignmentParser,
  configureEditorAlignmentSchemas,
} from "@/components/editor/editor-alignment";
import { findUnsupportedMarkdownFormats } from "@/lib/markdown";
import { createElement } from "react";
import { cleanup, render } from "@testing-library/react";
import { MarkdownContent } from "@/components/thread/markdown-content";
import { editorInlineCodeCommand } from "../editor-inline-code";

interface EditCase {
  id: string;
  markdown: string;
  operation: {
    anchor: string;
    offset: number;
    text: string;
    marks: Record<string, true | string>;
  };
  serialized: string;
  visibleText: string;
}

const fixture = JSON.parse(readFileSync(resolve(
  process.cwd(), "contracts/markdown-editor-roundtrip-v7-fixtures.json",
), "utf8")) as { editCases: EditCase[]; inlineInsertTexts: string[] };

function anchorIn(doc: ProseNode, anchor: string) {
  const matches: Array<{ node: ProseNode; position: number }> = [];
  doc.descendants((node, position) => {
    if (node.isText && node.text?.includes(anchor)) {
      matches.push({ node, position: position + node.text.indexOf(anchor) });
    }
  });
  expect(matches).toHaveLength(1);
  return matches[0]!;
}

async function withEditor(markdown: string, run: (crepe: CrepeBuilder, emitted: string[]) => void) {
  const root = document.createElement("div");
  document.body.append(root);
  const emitted: string[] = [];
  const crepe = new CrepeBuilder({
    root,
    defaultValue: prepareEditorMarkdown(markdown, { markdownContractVersion: 5 }),
  });
  crepe.addFeature(imageBlock);
  crepe.editor
    .config((ctx) => configureEditorAlignmentParser(ctx, { markdownContractVersion: 5 }))
    .config((ctx) => configureEditorAlignmentSchemas(ctx, { markdownContractVersion: 5 }))
    .config(configureEditorMarkdownSerializer)
    .use(editorAttentionBoundaryParser)
    .use(editorSoftBreakParser)
    .use(editorInlineCodeCommand)
    .use(editorBoundaryTextSchema)
    .use(createEditorMarkdownBridge({
      markdownContractVersion: 5,
      onChange: (value) => emitted.push(value),
      onError: (error) => { throw error; },
    }));
  try {
    await crepe.create();
    run(crepe, emitted);
  } finally {
    await crepe.destroy();
    root.remove();
  }
}

afterAll(async () => {
  // Milkdown ctx 在销毁后仍会完成内部定时器。
  await new Promise((resolve) => setTimeout(resolve, 3_100));
});

test("相邻粗体和斜体代码发布与重开保留所有 marks", async () => {
  await withEditor("土地culti", (crepe, emitted) => crepe.editor.action((ctx) => {
    const view = ctx.get(editorViewCtx);
    const { marks } = view.state.schema;
    view.dispatch(view.state.tr
      .addMark(1, 3, marks.strong!.create())
      .addMark(3, 8, marks.emphasis!.create())
      .addMark(3, 8, marks.inlineCode!.create()));
    const markdown = emitted.at(-1)!;
    expect(markdown).toBe("**土地**_`culti`_");
    const reader = render(createElement(MarkdownContent, { content: markdown }));
    try {
      expect(reader.container.querySelector("em code"), markdown).toHaveTextContent("culti");
      expect(reader.container.textContent).toBe("土地culti");
      const reopened = ctx.get(parserCtx)(prepareEditorMarkdown(markdown));
      expect(inlineSemantics(reopened), markdown).toEqual(inlineSemantics(view.state.doc));
      expect(serializeEditorMarkdown(ctx, reopened)).toBe(markdown);
    } finally {
      cleanup();
    }
  }));
});

describe("共享 v7 编辑操作契约", () => {
  test.each(fixture.editCases)("$id 实际事务后文字、样式和重开均稳定", async (item) => {
    await withEditor(item.markdown, (crepe, emitted) => crepe.editor.action((ctx) => {
      const view = ctx.get(editorViewCtx);
      const anchor = anchorIn(view.state.doc, item.operation.anchor);
      const position = anchor.position + item.operation.offset;
      view.dispatch(view.state.tr
        .setSelection(TextSelection.create(view.state.doc, position))
        .setStoredMarks(anchor.node.marks)
        .insertText(item.operation.text));

      expect(emitted.at(-1)).toBe(item.serialized);
      expect(view.state.doc.textContent).toBe(item.visibleText);
      const reopened = ctx.get(parserCtx)(item.serialized);
      expect(reopened.eq(view.state.doc)).toBe(true);
      expect(serializeEditorMarkdown(ctx, reopened)).toBe(item.serialized);
      expect(findUnsupportedMarkdownFormats(item.serialized)).toEqual([]);

      // 删除刚输入的文字后必须恢复原语义，不能因 operation 分片改变输出。
      view.dispatch(view.state.tr.delete(position, position + item.operation.text.length));
      expect(emitted.at(-1)).toBe(item.markdown);
    }));
  });

  test.each(fixture.editCases.filter((item) => item.operation.offset === 1))(
    "$id 标点、空白、Emoji 和反引号不改变文本或样式",
    async (item) => {
      await withEditor(item.markdown, (crepe) => crepe.editor.action((ctx) => {
        const view = ctx.get(editorViewCtx);
        const original = view.state.doc;
        const anchor = anchorIn(original, item.operation.anchor);
        const position = anchor.position + 1;
        for (const value of fixture.inlineInsertTexts) {
          view.dispatch(view.state.tr
            .setSelection(TextSelection.create(view.state.doc, position))
            .setStoredMarks(anchor.node.marks)
            .insertText(value));
          const markdown = serializeEditorMarkdown(ctx, view.state.doc);
          const reopened = ctx.get(parserCtx)(markdown);
          expect(reopened.textContent, value).toBe(`甲${value}乙`);
          expect(reopened.eq(view.state.doc), value).toBe(true);
          expect(serializeEditorMarkdown(ctx, reopened), value).toBe(markdown);
          expect(findUnsupportedMarkdownFormats(markdown), value).toEqual([]);
          view.dispatch(view.state.tr.delete(position, position + value.length));
          expect(view.state.doc.eq(original)).toBe(true);
        }
      }));
    },
  );

  test("引用内编辑粗体只写出一个连续粗体区间", async () => {
    await withEditor("> **甲乙**\n\n尾段", (crepe, emitted) => crepe.editor.action((ctx) => {
      const view = ctx.get(editorViewCtx);
      const anchor = anchorIn(view.state.doc, "甲乙");
      view.dispatch(view.state.tr
        .setSelection(TextSelection.create(view.state.doc, anchor.position + 1))
        .setStoredMarks(anchor.node.marks)
        .insertText("新"));
      expect(emitted.at(-1)).toBe("> **甲新乙**\n\n尾段");
      expect(ctx.get(parserCtx)(emitted.at(-1)!).eq(view.state.doc)).toBe(true);
    }));
  });

  test("协议空段紧邻对齐标题和图片经真实解析保留结构", async () => {
    const source = "前文\n<br />\n[wenyousite-align-v1-center]: #\n## 居中标题\n<br />\n[wenyousite-align-v1-right]: #\n![图片](https://cdn.example.com/a.png)\n\n尾段";
    await withEditor(source, (crepe) => crepe.editor.action((ctx) => {
      const doc = ctx.get(editorViewCtx).state.doc;
      expect(doc.textContent).toContain("居中标题");
      const markdown = serializeEditorMarkdown(ctx, doc);
      expect(findUnsupportedMarkdownFormats(markdown)).toEqual([]);
      expect(markdown.match(/<br \/>/g)).toHaveLength(2);
      expect(markdown).toContain("[wenyousite-align-v1-center]: #\n## 居中标题");
      expect(markdown).toMatch(/\[wenyousite-align-v1-right\]: #\n!\[[^\]]*\]\(https:\/\/cdn\.example\.com\/a\.png\)/);
      expect(serializeEditorMarkdown(ctx, ctx.get(parserCtx)(prepareEditorMarkdown(markdown)))).toBe(markdown);
    }));
  });
});


for (const source of ["## 甲", "### 甲", "- 甲", "1. 甲"]) {
  test(`${source} 行末 Enter 保持标题和列表常规行为`, async () => {
    await withEditor(source, (crepe) => crepe.editor.action((ctx) => {
      const view = ctx.get(editorViewCtx);
      const position = anchorIn(view.state.doc, "甲").position + 1;
      view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, position)));
      expect(view.someProp("handleKeyDown", (handle) => handle(view, new KeyboardEvent("keydown", { key: "Enter" })))).toBe(true);
      expect(view.state.selection.$from.parent.type.name).toBe("paragraph");
      expect(view.state.selection.$from.depth).toBe(source.startsWith("#") ? 1 : 3);
      if (!source.startsWith("#")) {
        expect(view.someProp("handleKeyDown", (handle) => handle(view, new KeyboardEvent("keydown", { key: "Enter" })))).toBe(true);
        expect(view.state.selection.$from.depth).toBe(1);
      }
    }));
  });
}
for (const prefix of ["", "> "]) {
  test(`${prefix || "正文"} Enter 后继续输入保留粗体`, async () => {
    await withEditor(`${prefix}**甲**${prefix ? "\n\n尾段" : ""}`, (crepe) => crepe.editor.action((ctx) => {
      const view = ctx.get(editorViewCtx);
      const position = anchorIn(view.state.doc, "甲").position + 1;
      view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, position)));
      view.someProp("handleKeyDown", (handle) => handle(view, new KeyboardEvent("keydown", { key: "Enter" })));
      view.dispatch(view.state.tr.insertText("乙"));
      expect(serializeEditorMarkdown(ctx, view.state.doc)).toBe(`${prefix}**甲**${prefix ? "\n" : "\n\n"}${prefix}**乙**${prefix ? "\n\n尾段" : ""}`);
    }));
  });
}
for (const alignment of ["center", "right"]) {
  test(`${alignment} 连续 Enter 保留空白行且新段左对齐`, async () => {
    await withEditor(`[wenyousite-align-v1-${alignment}]: #\n甲`, (crepe) => crepe.editor.action((ctx) => {
      const view = ctx.get(editorViewCtx);
      const position = anchorIn(view.state.doc, "甲").position + 1;
      view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, position)));
      for (let i = 0; i < 3; i++) view.someProp("handleKeyDown", (handle) => handle(view, new KeyboardEvent("keydown", { key: "Enter" })));
      view.dispatch(view.state.tr.insertText("乙"));
      const expected = `[wenyousite-align-v1-${alignment}]: #\n甲\n<br />\n<br />\n乙`;
      expect(serializeEditorMarkdown(ctx, view.state.doc)).toBe(expected);
      const reopened = ctx.get(parserCtx)(prepareEditorMarkdown(expected));
      expect(serializeEditorMarkdown(ctx, reopened)).toBe(expected);
    }));
  });
}


test("空白草稿连续 Enter 仍能保存与重开", async () => {
  await withEditor("", (crepe) => crepe.editor.action((ctx) => {
    const view = ctx.get(editorViewCtx);
    view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, 1)));
    for (let count = 1; count <= 3; count++) {
      expect(view.someProp("handleKeyDown", (handle) => handle(view, new KeyboardEvent("keydown", { key: "Enter" })))).toBe(true);
      const expected = Array.from({ length: count + 1 }, () => "<br />").join("\n");
      expect(serializeEditorMarkdown(ctx, view.state.doc)).toBe(expected);
      const reopened = ctx.get(parserCtx)(prepareEditorMarkdown(expected));
      expect(serializeEditorMarkdown(ctx, reopened)).toBe(expected);
    }
  }));
});

function inlineSemantics(doc: ProseNode) {
  const characters: unknown[] = [];
  doc.descendants((node) => {
    if (!node.isText) return;
    const marks = node.marks.map((mark) => mark.type.name === "link"
      ? `link:${mark.attrs.href}` : mark.type.name).sort();
    characters.push(...Array.from(node.text!, (text) => ({ text, marks })));
  });
  return characters;
}

const combinationNames = ["strong", "emphasis", "strike_through", "inlineCode", "link"];
const combinations = Array.from({ length: 32 }, (_, bits) =>
  combinationNames.filter((_, index) => bits & (1 << index)));

const standardParser = new MarkdownIt();
function standardSemantics(source: string) {
  const result: unknown[] = [];
  const active = new Map<string, string>();
  for (const token of standardParser.parse(source, {}).flatMap((block) => block.children ?? [])) {
    const type = token.type.replace(/_(open|close)$/, "");
    const mark = ({ strong: "strong", em: "emphasis", s: "strike_through", link: "link" } as Record<string, string>)[type];
    if (mark && token.type.endsWith("_open")) active.set(mark, mark === "link" ? `link:${token.attrGet("href")}` : mark);
    if (mark && token.type.endsWith("_close")) active.delete(mark);
    if (token.type === "text" || token.type === "code_inline") {
      const marks = [...active.values(), ...(token.type === "code_inline" ? ["inlineCode"] : [])].sort();
      result.push(...Array.from(token.content, (text) => ({ text, marks })));
    }
  }
  return result;
}

function readerSemantics(container: HTMLElement) {
  const result: unknown[] = [];
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const marks: string[] = [];
    for (let element = node.parentElement; element && element !== container; element = element.parentElement) {
      const mark = ({ STRONG: "strong", EM: "emphasis", DEL: "strike_through", CODE: "inlineCode" } as Record<string, string>)[element.tagName];
      if (mark) marks.push(mark);
      if (element.tagName === "A") marks.push(`link:${element.getAttribute("href")}`);
    }
    result.push(...Array.from(node.textContent!, (text) => ({ text, marks: marks.sort() })));
  }
  return result;
}

for (const names of combinations.filter((names) => !names.includes("inlineCode"))) {
  test(`${names.join("+") || "plain"} 部分选区叠加代码、取消和撤销重做`, async () => {
    await withEditor("甲乙丙", (crepe) => crepe.editor.action((ctx) => {
      const view = ctx.get(editorViewCtx);
      let tr = view.state.tr;
      for (const name of names) tr = tr.addMark(1, 4, view.state.schema.marks[name]!.create(
        name === "link" ? { href: "https://example.com/test" } : undefined,
      ));
      view.dispatch(tr);
      const before = view.state.doc;
      view.dispatch(closeHistory(view.state.tr.setSelection(TextSelection.create(view.state.doc, 2, 3))));
      expect(ctx.get(commandsCtx).call(toggleInlineCodeCommand.key)).toBe(true);
      const added = view.state.doc;
      expect(added.nodeAt(2)!.marks.map((mark) => mark.type.name).sort()).toEqual([...names, "inlineCode"].sort());
      const source = serializeEditorMarkdown(ctx, added);
      expect(inlineSemantics(ctx.get(parserCtx)(prepareEditorMarkdown(source))), source).toEqual(inlineSemantics(added));
      const reader = render(createElement(MarkdownContent, { content: source }));
      try { expect(readerSemantics(reader.container), source).toEqual(inlineSemantics(added)); }
      finally { cleanup(); }
      expect(undo(view.state, view.dispatch)).toBe(true);
      expect(view.state.doc.eq(before)).toBe(true);
      expect(redo(view.state, view.dispatch)).toBe(true);
      expect(view.state.doc.eq(added)).toBe(true);
      ctx.get(commandsCtx).call(toggleInlineCodeCommand.key);
      expect(view.state.doc.eq(before)).toBe(true);
    }));
  });
}

for (const value of ["*culti*", "（culti）", "`culti`", "``a`b``", "\\*&#42;_~", " culti ", "🙂culti!"]) {
  test(`${JSON.stringify(value)} 组合格式保留代码字面与定界符`, async () => {
    await withEditor("", (crepe) => crepe.editor.action((ctx) => {
      const view = ctx.get(editorViewCtx);
      const { schema } = view.state;
      for (const names of combinations.filter((names) => names.includes("inlineCode"))) {
        const marks = names.map((name) => schema.marks[name]!.create(name === "link" ? { href: "https://example.com/test" } : undefined));
        view.dispatch(view.state.tr.replaceWith(0, view.state.doc.content.size,
          schema.nodes.paragraph!.create(null, [schema.text("土地", [schema.marks.strong!.create()]), schema.text(value, marks), schema.text("尾")])));
        const source = serializeEditorMarkdown(ctx, view.state.doc);
        const expected = inlineSemantics(view.state.doc);
        expect(standardSemantics(source), source).toEqual(expected);
        const reopened = ctx.get(parserCtx)(prepareEditorMarkdown(source));
        expect(inlineSemantics(reopened), source).toEqual(expected);
        expect(serializeEditorMarkdown(ctx, reopened), source).toBe(source);
        const reader = render(createElement(MarkdownContent, { content: source }));
        try { expect(readerSemantics(reader.container), source).toEqual(expected); }
        finally { cleanup(); }
      }
    }));
  });
}

for (const [source, text] of [
  ["**土地***`culti`*", "culti"],
  ["**土地***``a`*b``*", "a`*b"],
  ["甲*`culti`*乙", "culti"],
]) {
  test(`历史代码外 attention 恢复且重写稳定：${source}`, async () => {
    const reader = render(createElement(MarkdownContent, { content: source }));
    try { expect(reader.container.querySelector("em code")).toHaveTextContent(text!); }
    finally { cleanup(); }
    await withEditor(source!, (crepe) => crepe.editor.action((ctx) => {
      const doc = ctx.get(editorViewCtx).state.doc;
      const source = serializeEditorMarkdown(ctx, doc);
      expect(doc.textContent).not.toMatch(/^土地\*/);
      expect(doc.nodeAt(source.startsWith("**") ? 3 : 2)!.marks.map((mark) => mark.type.name)).toContain("emphasis");
      const reopened = ctx.get(parserCtx)(prepareEditorMarkdown(source));
      expect(inlineSemantics(reopened)).toEqual(inlineSemantics(doc));
      expect(serializeEditorMarkdown(ctx, reopened)).toBe(source);
    }));
  });
}

for (const [source, visible] of [
  [String.raw`**土地**\*\`culti\`\*`.replaceAll("\\`", "`"), "土地*culti*"],
  ["**土地**&#42;`culti`&#42;", "土地*culti*"],
  ["**土地*** `culti` *", "土地* culti *"],
  ["**土地****`culti`*", "土地**culti*"],
  ["`*culti*`", "*culti*"],
  ["a_`x`_b", "a_x_b"],
  ["a~`x`~b", "a~x~b"],
  ["甲_`culti`_乙", "甲_culti_乙"],
  ["a****`x`****b", "a****x****b"],
  ["a*`x`**b", "a*x**b"],
  ["a*`x`b", "a*xb"],
  ["[a*`x`*b](https://example.com/test)", "a*x*b"],
]) {
  test(`字面代码边界不恢复：${source}`, async () => {
    const reader = render(createElement(MarkdownContent, { content: source }));
    try {
      expect(reader.container.querySelector("em")).toBeNull();
      expect(reader.container.textContent).toBe(visible);
    } finally { cleanup(); }
    await withEditor(source!, (crepe) => crepe.editor.action((ctx) => {
      const doc = ctx.get(editorViewCtx).state.doc;
      expect(doc.textContent).toBe(visible);
      expect(inlineSemantics(doc).some((item) => (item as { marks: string[] }).marks.includes("emphasis"))).toBe(false);
    }));
  });
}

for (const value of ["culti", "a*b", "a_b", "&amp;", "&#42;", "`a`", "\\*a*", "🙂a!"]) {
  test(`ASCII 两侧贴近 ${JSON.stringify(value)} 的全部样式组合`, async () => {
    await withEditor("", (crepe) => crepe.editor.action((ctx) => {
      const view = ctx.get(editorViewCtx);
      const { schema } = view.state;
      for (const names of combinations) {
        const marks = names.map((name) => schema.marks[name]!.create(name === "link" ? { href: "https://example.com/test" } : undefined));
        view.dispatch(view.state.tr.replaceWith(0, view.state.doc.content.size,
          schema.nodes.paragraph!.create(null, [schema.text("a"), schema.text(value, marks), schema.text("b")])));
        const source = serializeEditorMarkdown(ctx, view.state.doc);
        const expected = inlineSemantics(view.state.doc);
        expect(standardSemantics(source), source).toEqual(expected);
        const reopened = ctx.get(parserCtx)(prepareEditorMarkdown(source));
        expect(inlineSemantics(reopened), source).toEqual(expected);
        expect(serializeEditorMarkdown(ctx, reopened), source).toBe(source);
        const reader = render(createElement(MarkdownContent, { content: source }));
        try { expect(readerSemantics(reader.container), source).toEqual(expected); }
        finally { cleanup(); }
      }
    }));
  });
}

test("纯三个空格的代码与所有组合保留空格数量", async () => {
  await withEditor("", (crepe) => crepe.editor.action((ctx) => {
    const view = ctx.get(editorViewCtx);
    const { schema } = view.state;
    for (const names of combinations.filter((names) => names.includes("inlineCode"))) {
      const marks = names.map((name) => schema.marks[name]!.create(name === "link" ? { href: "https://example.com/test" } : undefined));
      view.dispatch(view.state.tr.replaceWith(0, view.state.doc.content.size,
        schema.nodes.paragraph!.create(null, [schema.text("a"), schema.text("   ", marks), schema.text("b")])));
      const source = serializeEditorMarkdown(ctx, view.state.doc);
      const expected = inlineSemantics(view.state.doc);
      const reopened = ctx.get(parserCtx)(prepareEditorMarkdown(source));
      expect(inlineSemantics(reopened), source).toEqual(expected);
      expect(serializeEditorMarkdown(ctx, reopened), source).toBe(source);
      const reader = render(createElement(MarkdownContent, { content: source }));
      try {
        expect(reader.container.querySelector("code")?.textContent).toBe("   ");
        expect(readerSemantics(reader.container), source).toEqual(expected);
      } finally { cleanup(); }
    }
  }));
});


type SharedMarks = Partial<Record<"bold" | "italic" | "strike" | "code", true>> & { link?: string };
type SharedSegment = { text: string; marks: SharedMarks };
const sharedMarkNames = { bold: "strong", italic: "emphasis", strike: "strike_through", code: "inlineCode", link: "link" };
const sharedCombinations = JSON.parse(readFileSync(resolve(process.cwd(), "contracts/markdown-inline-combinations-v1-fixtures.json"), "utf8")) as {
  version: number;
  markSets: { id: string; marks: SharedMarks }[];
  adjacencyMatrix: {
    leftText: string; rightText: string; separators: string[]; separatorMarks: SharedMarks;
    expectedPairCount: number; expectedCaseCount: number;
    contexts: { prefix: string; suffix: string }[];
    distinctLinkTargets: { left: string; right: string; expectedPairCount: number; expectedCaseCount: number };
  };
  textMatrix: { texts: string[]; expectedCaseCount: number; whitespacePolicy: Record<string, string> };
  cases: { id: string; kind: string; segments: SharedSegment[]; canonical?: string; markdown?: string;
    readingSegments?: SharedSegment[]; expectedSegments?: SharedSegment[];
    selection?: { anchor: number; focus: number };
    operation?: { mark: keyof SharedMarks; value: true | false | string };
  }[];
};
function sharedSemantics(segments: SharedSegment[]) {
  return segments.flatMap(({ text, marks }) => Array.from(text, (text) => ({ text,
    marks: Object.entries(marks).map(([name, value]) => name === "link" ? `link:${value}` : sharedMarkNames[name as keyof SharedMarks]).sort(),
  })));
}
function setSharedSegments(ctx: Ctx, segments: SharedSegment[]) {
  const view = ctx.get(editorViewCtx);
  const { schema } = view.state;
  const nodes = segments.filter((segment) => segment.text).map(({ text, marks }) => schema.text(text,
    Object.entries(marks).map(([name, value]) => schema.marks[sharedMarkNames[name as keyof SharedMarks]]!.create(
      name === "link" ? { href: value } : undefined,
    ))));
  view.dispatch(view.state.tr.replaceWith(0, view.state.doc.content.size, schema.nodes.paragraph!.create(null, nodes)));
}
function assertSharedRoundTrip(ctx: Ctx, expected: SharedSegment[], standard = true) {
  const view = ctx.get(editorViewCtx);
  const source = serializeEditorMarkdown(ctx, view.state.doc);
  const semantics = sharedSemantics(expected);
  if (standard) expect(standardSemantics(source), source).toEqual(semantics);
  const reader = render(createElement(MarkdownContent, { content: source }));
  try { expect(readerSemantics(reader.container), source).toEqual(semantics); }
  finally { cleanup(); }
  const reopened = ctx.get(parserCtx)(prepareEditorMarkdown(source));
  expect(inlineSemantics(reopened), source).toEqual(semantics);
  const second = serializeEditorMarkdown(ctx, reopened);
  expect(second, source).toBe(source);
  expect(inlineSemantics(ctx.get(parserCtx)(prepareEditorMarkdown(second))), source).toEqual(semantics);
  return source;
}

test("共享行内组合契约完整覆盖所有 marks 与展开数量", () => {
  expect(sharedCombinations.version).toBe(1);
  expect(new Set(sharedCombinations.markSets.map((set) => JSON.stringify(set.marks))).size).toBe(32);
  const matrix = sharedCombinations.adjacencyMatrix;
  expect(sharedCombinations.markSets.length ** 2).toBe(matrix.expectedPairCount);
  expect(matrix.expectedPairCount * matrix.separators.length * matrix.contexts.length).toBe(matrix.expectedCaseCount);
  const linked = sharedCombinations.markSets.filter((set) => set.marks.link).length;
  expect(linked ** 2).toBe(matrix.distinctLinkTargets.expectedPairCount);
  expect(linked ** 2 * matrix.separators.length * matrix.contexts.length).toBe(matrix.distinctLinkTargets.expectedCaseCount);
  expect(sharedCombinations.markSets.length * sharedCombinations.textMatrix.texts.length).toBe(sharedCombinations.textMatrix.expectedCaseCount);
});

for (const distinctLinks of [false, true]) for (const separator of sharedCombinations.adjacencyMatrix.separators)
  for (const context of sharedCombinations.adjacencyMatrix.contexts) {
    test(`共享邻接矩阵 ${JSON.stringify({ distinctLinks, separator, context })}`, async () => {
      await withEditor("", (crepe) => crepe.editor.action((ctx) => {
        const matrix = sharedCombinations.adjacencyMatrix;
        for (const left of sharedCombinations.markSets) for (const right of sharedCombinations.markSets) {
          if (distinctLinks && (!left.marks.link || !right.marks.link)) continue;
          const segments: SharedSegment[] = [
            { text: context.prefix, marks: {} },
            { text: matrix.leftText, marks: distinctLinks ? { ...left.marks, link: matrix.distinctLinkTargets.left } : left.marks },
            { text: separator, marks: matrix.separatorMarks },
            { text: matrix.rightText, marks: distinctLinks ? { ...right.marks, link: matrix.distinctLinkTargets.right } : right.marks },
            { text: context.suffix, marks: {} },
          ];
          setSharedSegments(ctx, segments);
          expect(inlineSemantics(ctx.get(editorViewCtx).state.doc)).toEqual(sharedSemantics(segments));
          const source = assertSharedRoundTrip(ctx, segments);
          exportedSamples.push({ id: `adjacency:${left.id}:${right.id}:${JSON.stringify({ distinctLinks, separator, context })}`, markdown: source, expectedSegments: segments });
        }
      }));
    }, 180_000);
  }

for (const item of sharedCombinations.cases) {
  test(`共享独立语义用例 ${item.id}`, async () => {
    await withEditor(item.markdown ?? item.canonical ?? "", (crepe) => crepe.editor.action((ctx) => {
      const view = ctx.get(editorViewCtx);
      if (item.markdown || item.canonical) {
        expect(inlineSemantics(view.state.doc)).toEqual(sharedSemantics(item.readingSegments ?? item.segments));
        const reader = render(createElement(MarkdownContent, { content: item.markdown ?? item.canonical! }));
        try { expect(readerSemantics(reader.container)).toEqual(sharedSemantics(item.readingSegments ?? item.segments)); }
        finally { cleanup(); }
      } else setSharedSegments(ctx, item.segments);
      if (item.operation && item.selection) {
        const mark = view.state.schema.marks[sharedMarkNames[item.operation.mark]]!;
        const { anchor, focus } = item.selection;
        const selection = TextSelection.create(view.state.doc, anchor + 1, focus + 1);
        const tr = closeHistory(view.state.tr.setSelection(selection));
        view.dispatch(tr);
        const previous = view.state.doc;
        view.dispatch(item.operation.value === false
          ? view.state.tr.removeMark(selection.from, selection.to, mark)
          : view.state.tr.addMark(selection.from, selection.to, mark.create(item.operation.mark === "link" ? { href: item.operation.value } : undefined)));
        expect(inlineSemantics(view.state.doc)).toEqual(sharedSemantics(item.expectedSegments!));
        const edited = view.state.doc;
        expect(undo(view.state, view.dispatch)).toBe(true);
        expect(view.state.doc.eq(previous)).toBe(true);
        expect(redo(view.state, view.dispatch)).toBe(true);
        expect(view.state.doc.eq(edited)).toBe(true);
      }
      // 纯空格代码由产品协议阅读器核验；markdown-it 14 自身会误裁两端空格。
      assertSharedRoundTrip(ctx, item.expectedSegments ?? item.segments, item.id !== "code-only-spaces");
    }));
  });
}


for (const text of sharedCombinations.textMatrix.texts) {
  test(`共享特殊文本矩阵 ${JSON.stringify(text)}`, async () => {
    expect(sharedCombinations.textMatrix.whitespacePolicy).toEqual({
      withCode: "preserve-all-text-and-marks", withoutCode: "move-leading-and-trailing-whitespace-to-unmarked-segments",
      whitespaceDefinition: "Unicode White_Space", allWhitespaceWithoutCode: "single-unmarked-segment",
    });
    await withEditor("", (crepe) => crepe.editor.action((ctx) => {
      for (const { marks } of sharedCombinations.markSets) {
        const segments = [{ text, marks }];
        setSharedSegments(ctx, segments);
        expect(inlineSemantics(ctx.get(editorViewCtx).state.doc)).toEqual(sharedSemantics(segments));
        let expected = segments;
        if (!marks.code) {
          const leading = /^\p{White_Space}*/u.exec(text)![0];
          const trailing = /\p{White_Space}*$/u.exec(text)![0];
          const core = text.slice(leading.length, Math.max(leading.length, text.length - trailing.length));
          expected = core ? [{ text: leading, marks: {} }, { text: core, marks }, { text: trailing, marks: {} }] : [{ text, marks: {} }];
        }
        // 产品协议保留行尾空白，标准 CommonMark 会裁剪；此类输入由真实阅读器核验。
        const source = assertSharedRoundTrip(ctx, expected, !/^\p{White_Space}|\p{White_Space}$/u.test(text));
        exportedSamples.push({ id: `text:${JSON.stringify({ text, marks })}`, markdown: source, expectedSegments: expected });
      }
    }));
  });
}


const exportedSamples: { id: string; markdown: string; expectedSegments: SharedSegment[] }[] = [];
afterAll(() => {
  const output = process.env.WENYOU_INLINE_EXPORT;
  if (!output) return;
  writeFileSync(output, JSON.stringify({
    contract: "wenyousite-inline-cross-client-result", version: 1, producer: "web",
    producerCommit: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
    fixtureCommit: "f3cad6799d7fdd6b484d7341b3b918970767a190",
    fixtureSha256: createHash("sha256").update(readFileSync(resolve(process.cwd(), "contracts/markdown-inline-combinations-v1-fixtures.json"))).digest("hex"),
    samples: exportedSamples,
  }, null, 2));
});

if (process.env.WENYOU_INLINE_IMPORT) {
  const candidate = JSON.parse(readFileSync(process.env.WENYOU_INLINE_IMPORT, "utf8")) as {
    producerCommit: string; fixtureSha256: string;
    samples: { id: string; markdown: string; expectedSegments: SharedSegment[] }[];
  };
  test("跨端候选互读：真实 Milkdown、发布 DOM、再次保存语义稳定", async () => {
    expect(candidate.producerCommit).toMatch(/^[a-f0-9]{40}$/u);
    expect(candidate.fixtureSha256).toBe(createHash("sha256").update(readFileSync(resolve(process.cwd(), "contracts/markdown-inline-combinations-v1-fixtures.json"))).digest("hex"));
    expect(candidate.samples.length).toBeGreaterThanOrEqual(11_904);
    await withEditor("", (crepe) => crepe.editor.action((ctx) => {
      const view = ctx.get(editorViewCtx);
      for (const sample of candidate.samples) {
        const parsed = ctx.get(parserCtx)(prepareEditorMarkdown(sample.markdown));
        expect(inlineSemantics(parsed), sample.id).toEqual(sharedSemantics(sample.expectedSegments));
        const reader = render(createElement(MarkdownContent, { content: sample.markdown }));
        try { expect(readerSemantics(reader.container), sample.id).toEqual(sharedSemantics(sample.expectedSegments)); }
        finally { cleanup(); }
        view.dispatch(view.state.tr.replaceWith(0, view.state.doc.content.size, parsed.content));
        assertSharedRoundTrip(ctx, sample.expectedSegments, false);
      }
    }));
  }, 180_000);
}

for (const marks of [{ bold: true }, { strike: true }, { link: "https://example.com/test" }] satisfies SharedMarks[]) {
  test(`分片交界空格保留共同 marks：${JSON.stringify(marks)}`, async () => {
    await withEditor("", (crepe) => crepe.editor.action((ctx) => {
      for (const segments of [
        [{ text: "a ", marks }, { text: "b", marks: { ...marks, italic: true as const } }],
        [{ text: "a", marks: { ...marks, italic: true as const } }, { text: " b", marks }],
        [{ text: "a", marks: { ...marks, italic: true as const } }, { text: " ", marks }, { text: "b", marks: { ...marks, code: true as const } }],
      ]) {
        setSharedSegments(ctx, segments);
        assertSharedRoundTrip(ctx, segments);
      }
    }));
  });
}
