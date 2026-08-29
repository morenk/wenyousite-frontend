import type { Ctx } from "@milkdown/kit/ctx";
import type { Node as ProseNode } from "@milkdown/kit/prose/model";
import {
  headingAttr,
  headingIdGenerator,
  headingSchema,
  paragraphAttr,
  paragraphSchema,
} from "@milkdown/kit/preset/commonmark";
import { describe, expect, test, vi } from "vitest";
import { configureEditorAlignmentSchemas } from "@/components/editor/editor-alignment";
import {
  alignmentLabel,
  isStoredWenyouTextAlignment,
  normalizeSerializedAlignmentMarkers,
  remarkWenyouAlignment,
  WENYOU_ALIGNMENT_ATTRIBUTE,
  type AlignmentMarkdownNode,
} from "@/lib/markdown-alignment";
import {
  findUnsupportedMarkdownFormats,
  sanitizeMilkdownMarkdown,
} from "@/lib/markdown";
import { DICE_INLINE_NODE_NAME } from "@/lib/dice-inline";
import { STICKER_INLINE_NODE_NAME } from "@/lib/sticker-inline";

const CENTER_MARKER = "[wenyousite-align-v1-center]: #";
const RIGHT_MARKER = "[wenyousite-align-v1-right]: #";
const DICE_NODE_ID = "550e8400-e29b-41d4-a716-446655440000";

function marker(
  alignment: string,
  line: number,
  overrides: Partial<AlignmentMarkdownNode> = {},
): AlignmentMarkdownNode {
  const identifier = `wenyousite-align-v1-${alignment}`;
  return {
    type: "definition",
    identifier,
    label: identifier,
    url: "#",
    title: null,
    position: { start: { line }, end: { line } },
    ...overrides,
  };
}

function alignableBlock(
  kind: "paragraph" | "heading",
  line: number,
  depth?: number,
): AlignmentMarkdownNode {
  return {
    type: kind,
    depth,
    position: { start: { line }, end: { line } },
    children: [{ type: "text" }],
  };
}

function transformTree(children: AlignmentMarkdownNode[]): AlignmentMarkdownNode {
  const tree: AlignmentMarkdownNode = { type: "root", children };
  remarkWenyouAlignment()(tree);
  return tree;
}

type MarkdownParserState = {
  openNode: ReturnType<typeof vi.fn>;
  next: ReturnType<typeof vi.fn>;
  addText: ReturnType<typeof vi.fn>;
  closeNode: ReturnType<typeof vi.fn>;
};

type MarkdownSerializerState = {
  addNode: ReturnType<typeof vi.fn>;
};

type AlignmentSchema = {
  attrs: Record<string, unknown>;
  parseDOM: Array<{
    tag: string;
    getAttrs: (node: string | HTMLElement) => Record<string, unknown>;
  }>;
  toDOM: (node: ProseNode) => readonly unknown[];
  parseMarkdown: {
    runner: (
      state: MarkdownParserState,
      node: AlignmentMarkdownNode & { value?: unknown },
      type: unknown,
    ) => void;
  };
  toMarkdown: {
    runner: (state: MarkdownSerializerState, node: ProseNode) => void;
  };
};

type AlignmentSchemaHarness = {
  paragraph: AlignmentSchema;
  heading: AlignmentSchema;
  paragraphBaseSerializer: ReturnType<typeof vi.fn>;
  headingBaseSerializer: ReturnType<typeof vi.fn>;
};

/** 用最小 Milkdown ctx 捕获 schema 扩展，直接测试协议边界而不挂载编辑器。 */
function createAlignmentSchemaHarness(): AlignmentSchemaHarness {
  type SchemaFactory = (schemaCtx: unknown) => AlignmentSchema;
  type SchemaUpdater = (previous: SchemaFactory) => SchemaFactory;

  const paragraphBaseSerializer = vi.fn();
  const headingBaseSerializer = vi.fn();
  const configured = new Map<unknown, AlignmentSchema>();
  const schemaCtx = {
    get: (key: unknown) => {
      if (key === headingIdGenerator.key) return () => "generated-heading-id";
      if (key === paragraphAttr.key) {
        return () => ({ "data-base-paragraph": "kept" });
      }
      if (key === headingAttr.key) {
        return () => ({ "data-base-heading": "kept" });
      }
      throw new Error("测试 schemaCtx 收到未知 key");
    },
  };

  const ctx = {
    update: (key: unknown, updater: SchemaUpdater) => {
      const baseSerializer = key === paragraphSchema.key
        ? paragraphBaseSerializer
        : headingBaseSerializer;
      const base: AlignmentSchema = {
        attrs: { existing: { default: "kept" } },
        parseDOM: [],
        toDOM: () => ["base", 0],
        parseMarkdown: { runner: vi.fn() },
        toMarkdown: { runner: baseSerializer },
      };
      configured.set(key, updater(() => base)(schemaCtx));
    },
  };

  configureEditorAlignmentSchemas(ctx as unknown as Ctx);

  const paragraph = configured.get(paragraphSchema.key);
  const heading = configured.get(headingSchema.key);
  if (!paragraph || !heading) throw new Error("未捕获完整的对齐 schema");
  return {
    paragraph,
    heading,
    paragraphBaseSerializer,
    headingBaseSerializer,
  };
}

type Descendant = {
  type: { name: string };
  isText: boolean;
  isInline: boolean;
  isAtom: boolean;
  text?: string;
};

function textDescendant(text: string): Descendant {
  return {
    type: { name: "text" },
    isText: true,
    isInline: true,
    isAtom: false,
    text,
  };
}

function atomDescendant(name: string): Descendant {
  return {
    type: { name },
    isText: false,
    isInline: true,
    isAtom: true,
  };
}

function proseBlock(
  textAlign: unknown,
  descendants: Descendant[],
  attrs: Record<string, unknown> = {},
): ProseNode {
  const node = {
    attrs: { ...attrs, textAlign },
    descendants: (visitor: (child: ProseNode) => boolean | void) => {
      for (const child of descendants) {
        if (visitor(child as unknown as ProseNode) === false) break;
      }
    },
  };
  return node as unknown as ProseNode;
}

function parserState(): MarkdownParserState {
  return {
    openNode: vi.fn(),
    next: vi.fn(),
    addText: vi.fn(),
    closeNode: vi.fn(),
  };
}

describe("Markdown v4 对齐枚举", () => {
  test.each([
    ["center", true],
    ["right", true],
    ["left", false],
    ["justify", false],
    ["CENTER", false],
    ["right; color:red", false],
    [null, false],
    [undefined, false],
  ])("存储值 %j 的受控枚举判断为 %s", (value, expected) => {
    expect(isStoredWenyouTextAlignment(value)).toBe(expected);
  });

  test("左中右标签稳定且左对齐只作为默认态存在", () => {
    expect(alignmentLabel("left")).toBe("左对齐");
    expect(alignmentLabel("center")).toBe("居中对齐");
    expect(alignmentLabel("right")).toBe("右对齐");
  });
});

describe("remark 顶层对齐标记绑定", () => {
  test.each([
    ["paragraph", undefined, "center"],
    ["paragraph", undefined, "right"],
    ["heading", 2, "center"],
    ["heading", 2, "right"],
    ["heading", 3, "center"],
    ["heading", 3, "right"],
  ] as const)(
    "%s/H%s 紧邻合法 %s 标记时消费定义并只写受控属性",
    (kind, depth, alignment) => {
      const target = alignableBlock(kind, 2, depth);
      target.data = {
        preserved: "yes",
        hProperties: { className: ["existing"] },
      };
      const tree = transformTree([marker(alignment, 1), target]);

      expect(tree.children).toEqual([target]);
      expect(target.data).toEqual({
        preserved: "yes",
        wenyouAlign: alignment,
        hProperties: {
          className: ["existing"],
          [WENYOU_ALIGNMENT_ATTRIBUTE]: alignment,
        },
      });
    },
  );

  test("默认左对齐不需要标记且连续 P/H2/H3 块互不串位", () => {
    const centered = alignableBlock("paragraph", 2);
    const rightH2 = alignableBlock("heading", 4, 2);
    const centeredH3 = alignableBlock("heading", 6, 3);
    const left = alignableBlock("paragraph", 8);
    const tree = transformTree([
      marker("center", 1),
      centered,
      marker("right", 3),
      rightH2,
      marker("center", 5),
      centeredH3,
      left,
    ]);

    expect(tree.children).toEqual([centered, rightH2, centeredH3, left]);
    expect(tree.children?.map((node) => node.data?.wenyouAlign ?? "left")).toEqual([
      "center",
      "right",
      "center",
      "left",
    ]);
  });

  test("富行内子树绑定前后完全不变，重复运行转换保持幂等", () => {
    const richChildren = [
      { type: "text", value: "普通 " },
      { type: "strong", children: [{ type: "text", value: "粗体" }] },
      { type: "emphasis", children: [{ type: "text", value: "斜体" }] },
      { type: "delete", children: [{ type: "text", value: "删除" }] },
      { type: "inlineCode", value: "代码" },
      {
        type: "link",
        url: "https://example.com",
        children: [{ type: "text", value: "链接" }],
      },
      {
        type: "link",
        url: "/users/user-1",
        children: [{ type: "text", value: "@玩家" }],
      },
      { type: "diceInline", nodeId: DICE_NODE_ID, notation: "1d20" },
      {
        type: "image",
        url: "https://cdn.example.com/stickers/a.webp",
        title: "wenyousite-sticker:v1:asset-1",
        label: "表情",
      },
    ] as unknown as AlignmentMarkdownNode[];
    const before = structuredClone(richChildren);
    const target = alignableBlock("paragraph", 2);
    target.children = richChildren;
    const tree = transformTree([marker("center", 1), target]);

    expect(target.children).toEqual(before);
    expect(target.data?.wenyouAlign).toBe("center");
    const afterFirstPass = structuredClone(tree);
    remarkWenyouAlignment()(tree);
    expect(tree).toEqual(afterFirstPass);
  });

  test("空行破坏邻接，孤立标记和后续正文都不会被吞掉", () => {
    const target = alignableBlock("paragraph", 3);
    const definition = marker("center", 1);
    const tree = transformTree([definition, target]);

    expect(tree.children).toEqual([definition, target]);
    expect(target.data?.wenyouAlign).toBeUndefined();
  });

  test.each([
    ["left", {}],
    ["justify", {}],
    ["center", { identifier: "wenyousite-align-v2-center" }],
    ["center", { identifier: "WENYOUSITE-align-v1-center" }],
    ["center", { url: "/not-a-marker" }],
    ["center", { title: "not-null" }],
    ["center", { type: "paragraph" }],
  ] as const)("非法或未知定义 %s / %j 不绑定", (alignment, overrides) => {
    const definition = marker(alignment, 1, overrides);
    const target = alignableBlock("paragraph", 2);
    const tree = transformTree([definition, target]);

    expect(tree.children).toEqual([definition, target]);
    expect(target.data?.wenyouAlign).toBeUndefined();
  });

  test.each([
    ["heading-1", alignableBlock("heading", 2, 1)],
    ["heading-4", alignableBlock("heading", 2, 4)],
    ["list", { type: "list", position: { start: { line: 2 }, end: { line: 2 } } }],
    ["blockquote", { type: "blockquote", position: { start: { line: 2 }, end: { line: 2 } } }],
    ["thematic-break", { type: "thematicBreak", position: { start: { line: 2 }, end: { line: 2 } } }],
    ["image", { type: "image", position: { start: { line: 2 }, end: { line: 2 } } }],
    ["html", { type: "html", position: { start: { line: 2 }, end: { line: 2 } } }],
  ] as const)("顶层不合格目标 %s 不绑定", (_label, targetValue) => {
    const target = targetValue as AlignmentMarkdownNode;
    const definition = marker("right", 1);
    const tree = transformTree([definition, target]);

    expect(tree.children).toEqual([definition, target]);
    expect(target.data?.wenyouAlign).toBeUndefined();
  });

  test("嵌套在列表或引用中的标记不参与顶层扫描", () => {
    const nestedParagraph = alignableBlock("paragraph", 3);
    const tree: AlignmentMarkdownNode = {
      type: "root",
      children: [{
        type: "blockquote",
        children: [marker("center", 2), nestedParagraph],
      }, {
        type: "list",
        children: [{
          type: "listItem",
          children: [marker("right", 5), alignableBlock("paragraph", 6)],
        }],
      }],
    };
    const before = structuredClone(tree);

    remarkWenyouAlignment()(tree);
    expect(tree).toEqual(before);
  });
});

describe("编辑器 schema 的解析、DOM 与写出边界", () => {
  test.each([
    ["paragraph", undefined, "center"],
    ["paragraph", undefined, "right"],
    ["heading", 2, "center"],
    ["heading", 2, "right"],
    ["heading", 3, "center"],
    ["heading", 3, "right"],
  ] as const)("%s/H%s Markdown 解析只接收受控 %s 元数据", (kind, depth, alignment) => {
    const harness = createAlignmentSchemaHarness();
    const schema = kind === "paragraph" ? harness.paragraph : harness.heading;
    const state = parserState();
    const children = [{ type: "text" }];
    schema.parseMarkdown.runner(state, {
      type: kind,
      depth,
      data: { wenyouAlign: alignment },
      children,
    }, `${kind}-type`);

    expect(state.openNode).toHaveBeenCalledWith(
      `${kind}-type`,
      kind === "heading"
        ? { level: depth, textAlign: alignment }
        : { textAlign: alignment },
    );
    expect(state.next).toHaveBeenCalledWith(children);
    expect(state.closeNode).toHaveBeenCalledOnce();
  });

  test.each(["left", "justify", "CENTER", "right;display:none", undefined])(
    "Markdown 元数据 %j 一律回落为左对齐",
    (value) => {
      const { paragraph } = createAlignmentSchemaHarness();
      const state = parserState();
      paragraph.parseMarkdown.runner(state, {
        type: "paragraph",
        data: {
          wenyouAlign: value,
          hProperties: {
            style: "text-align:right",
            align: "right",
          },
        },
        children: [{ type: "text" }],
      }, "paragraph-type");

      expect(state.openNode).toHaveBeenCalledWith("paragraph-type", {
        textAlign: "left",
      });
    },
  );

  test("外部 style/align/CSS 不会创建对齐，受控 data 属性才会被读取", () => {
    const { paragraph, heading } = createAlignmentSchemaHarness();
    const paragraphElement = document.createElement("p");
    paragraphElement.style.textAlign = "right";
    paragraphElement.setAttribute("align", "center");
    expect(paragraph.parseDOM[0]!.getAttrs(paragraphElement)).toEqual({
      textAlign: "left",
    });

    paragraphElement.setAttribute(WENYOU_ALIGNMENT_ATTRIBUTE, "right");
    expect(paragraph.parseDOM[0]!.getAttrs(paragraphElement)).toEqual({
      textAlign: "right",
    });

    const headingElement = document.createElement("h2");
    headingElement.id = "kept-id";
    headingElement.style.textAlign = "center";
    headingElement.setAttribute("align", "right");
    expect(heading.parseDOM[1]!.getAttrs(headingElement)).toEqual({
      id: "kept-id",
      level: 2,
      textAlign: "left",
    });
    headingElement.setAttribute(WENYOU_ALIGNMENT_ATTRIBUTE, "center");
    expect(heading.parseDOM[1]!.getAttrs(headingElement)).toEqual({
      id: "kept-id",
      level: 2,
      textAlign: "center",
    });
  });

  test("DOM 写出仅输出 center/right data 属性并保留既有 schema 属性", () => {
    const { paragraph, heading } = createAlignmentSchemaHarness();
    const centeredParagraph = paragraph.toDOM(
      proseBlock("center", [textDescendant("正文")]),
    );
    expect(centeredParagraph).toEqual([
      "p",
      {
        "data-base-paragraph": "kept",
        [WENYOU_ALIGNMENT_ATTRIBUTE]: "center",
      },
      0,
    ]);

    const rightHeading = heading.toDOM(
      proseBlock("right", [textDescendant("标题")], { level: 3, id: "" }),
    );
    expect(rightHeading).toEqual([
      "h3",
      {
        "data-base-heading": "kept",
        [WENYOU_ALIGNMENT_ATTRIBUTE]: "right",
        id: "generated-heading-id",
      },
      0,
    ]);

    for (const value of ["left", "justify", "center; color:red"]) {
      expect(paragraph.toDOM(proseBlock(value, [textDescendant("正文")]))[1])
        .not.toHaveProperty(WENYOU_ALIGNMENT_ATTRIBUTE);
    }
  });

  test.each([
    ["paragraph", undefined, "center"],
    ["paragraph", undefined, "right"],
    ["heading", 2, "center"],
    ["heading", 2, "right"],
    ["heading", 3, "center"],
    ["heading", 3, "right"],
  ] as const)(
    "%s/H%s %s 非空块先写隐藏定义，再交给原始 stringifier 保留行内格式",
    (kind, level, alignment) => {
      const harness = createAlignmentSchemaHarness();
      const schema = kind === "paragraph" ? harness.paragraph : harness.heading;
      const baseSerializer = kind === "paragraph"
        ? harness.paragraphBaseSerializer
        : harness.headingBaseSerializer;
      const state: MarkdownSerializerState = { addNode: vi.fn() };
      const node = proseBlock(alignment, [
        textDescendant("普通"),
        atomDescendant(DICE_INLINE_NODE_NAME),
        atomDescendant(STICKER_INLINE_NODE_NAME),
      ], level === undefined ? {} : { level, id: "heading-id" });

      schema.toMarkdown.runner(state, node);

      const identifier = `wenyousite-align-v1-${alignment}`;
      expect(state.addNode).toHaveBeenCalledWith(
        "definition",
        undefined,
        undefined,
        {
          identifier,
          label: identifier,
          title: null,
          url: "#",
        },
      );
      expect(baseSerializer).toHaveBeenCalledWith(state, node);
      expect(state.addNode.mock.invocationCallOrder[0]).toBeLessThan(
        baseSerializer.mock.invocationCallOrder[0]!,
      );
    },
  );

  test.each([
    ["默认左对齐", "left", [textDescendant("正文")]],
    ["未知枚举", "justify", [textDescendant("正文")]],
    ["空块", "center", []],
    ["空白块", "right", [textDescendant(" \t")]],
    ["仅 hardbreak", "center", [atomDescendant("hardbreak")]],
    ["含普通内联图片", "right", [
      textDescendant("正文"),
      atomDescendant("image"),
    ]],
    ["含普通块图片", "center", [
      textDescendant("正文"),
      atomDescendant("image-block"),
    ]],
  ] as const)("%s 不写对齐标记", (_label, alignment, descendants) => {
    const harness = createAlignmentSchemaHarness();
    const state: MarkdownSerializerState = { addNode: vi.fn() };
    const node = proseBlock(alignment, [...descendants]);

    harness.paragraph.toMarkdown.runner(state, node);
    expect(state.addNode).not.toHaveBeenCalled();
    expect(harness.paragraphBaseSerializer).toHaveBeenCalledWith(state, node);
  });

  test.each([
    ["纯骰子", DICE_INLINE_NODE_NAME],
    ["纯收藏表情", STICKER_INLINE_NODE_NAME],
    ["纯行内提及原子", "mention"],
  ])("%s 仍属于可对齐行内内容", (_label, nodeName) => {
    const { paragraph } = createAlignmentSchemaHarness();
    const state: MarkdownSerializerState = { addNode: vi.fn() };

    paragraph.toMarkdown.runner(
      state,
      proseBlock("center", [atomDescendant(nodeName)]),
    );
    expect(state.addNode).toHaveBeenCalledWith(
      "definition",
      undefined,
      undefined,
      expect.objectContaining({ identifier: "wenyousite-align-v1-center" }),
    );
  });
});

describe("字符串协议、兼容净化与幂等", () => {
  test.each([CENTER_MARKER, RIGHT_MARKER])(
    "%s 的 stringifier 空行只折叠为一次严格邻接",
    (definition) => {
      const serialized = `${definition}\n\n\n正文`;
      const normalized = `${definition}\n正文`;
      expect(normalizeSerializedAlignmentMarkers(serialized)).toBe(normalized);
      expect(normalizeSerializedAlignmentMarkers(normalized)).toBe(normalized);
    },
  );

  test("规范化不改 left、未知版本、孤立标记和正文自身缩进", () => {
    const input = [
      "[wenyousite-align-v1-left]: #",
      "",
      "左对齐仍是字面协议外文本",
      "[wenyousite-align-v2-center]: #",
      "",
      "未知版本",
      CENTER_MARKER,
    ].join("\n");
    expect(normalizeSerializedAlignmentMarkers(input)).toBe(input);
    expect(normalizeSerializedAlignmentMarkers(`${RIGHT_MARKER}\n\n  正文`))
      .toBe(`${RIGHT_MARKER}\n  正文`);
  });

  test("CRLF 合法输入统一为 LF，连续 P/H2/H3 与默认左对齐无损且幂等", () => {
    const crlf = [
      CENTER_MARKER,
      "普通段落",
      "",
      RIGHT_MARKER,
      "## 二级标题",
      "",
      CENTER_MARKER,
      "### 三级标题",
      "",
      "默认左对齐",
    ].join("\r\n");
    const canonical = crlf.replaceAll("\r\n", "\n");

    expect(findUnsupportedMarkdownFormats(crlf)).toEqual([]);
    expect(sanitizeMilkdownMarkdown(crlf)).toBe(canonical);
    expect(sanitizeMilkdownMarkdown(canonical)).toBe(canonical);
  });

  test.each([
    ["P left", "普通段落"],
    ["P center", `${CENTER_MARKER}\n普通段落`],
    ["P right", `${RIGHT_MARKER}\n普通段落`],
    ["H2 left", "## 二级标题"],
    ["H2 center", `${CENTER_MARKER}\n## 二级标题`],
    ["H2 right", `${RIGHT_MARKER}\n## 二级标题`],
    ["H3 left", "### 三级标题"],
    ["H3 center", `${CENTER_MARKER}\n### 三级标题`],
    ["H3 right", `${RIGHT_MARKER}\n### 三级标题`],
  ])("%s 的存储形态合法、无损且幂等", (_label, markdown) => {
    expect(findUnsupportedMarkdownFormats(markdown)).toEqual([]);
    expect(sanitizeMilkdownMarkdown(markdown)).toBe(markdown);
    expect(sanitizeMilkdownMarkdown(sanitizeMilkdownMarkdown(markdown)))
      .toBe(markdown);
  });

  test("对齐块与粗斜删、行内代码、链接、提及、骰子、表情组合无损", () => {
    const richParagraph = [
      CENTER_MARKER,
      `普通 **粗体** *斜体* ~~删除~~ \`代码\` [链接](https://example.com) `
        + `[@玩家](/users/user-1) [[dice:v1:${DICE_NODE_ID}:1d20]] `
        + "![表情](https://cdn.example.com/stickers/a.webp \"wenyousite-sticker:v1:asset-1\")",
      "",
      RIGHT_MARKER,
      "## [**粗 _斜_** 和 ~~删 `码`~~](https://example.com)",
      "",
      CENTER_MARKER,
      "### 三级 ***粗斜体*** 与 [@全体玩家](/users/all)",
    ].join("\n");

    expect(findUnsupportedMarkdownFormats(richParagraph)).toEqual([]);
    expect(sanitizeMilkdownMarkdown(richParagraph)).toBe(richParagraph);
    expect(sanitizeMilkdownMarkdown(sanitizeMilkdownMarkdown(richParagraph)))
      .toBe(richParagraph);
  });

  test.each([
    ["left 标记", "[wenyousite-align-v1-left]: #", "invalid-alignment"],
    ["未知枚举", "[wenyousite-align-v1-justify]: #", "invalid-alignment"],
    ["未知版本", "[wenyousite-align-v2-center]: #", "unknown-protocol"],
    ["错误大小写", "[WENYOUSITE-align-v1-center]: #", "invalid-alignment"],
    ["枚举大小写", "[wenyousite-align-v1-Center]: #", "invalid-alignment"],
    ["多余空格", "[wenyousite-align-v1-center]:  #", "invalid-alignment"],
    ["多余标题", "[wenyousite-align-v1-center]: # \"title\"", "invalid-alignment"],
  ] as const)("%s 静默字面降级、保留正文且结果幂等", (_label, definition, type) => {
    const input = `${definition}\n正文`;
    expect(findUnsupportedMarkdownFormats(input)).toContainEqual({
      type,
      startLine: 0,
      endLine: 0,
    });

    const sanitized = sanitizeMilkdownMarkdown(input);
    expect(sanitized).toContain("正文");
    expect(sanitized).not.toBe(input);
    expect(findUnsupportedMarkdownFormats(sanitized)).toEqual([]);
    expect(sanitizeMilkdownMarkdown(sanitized)).toBe(sanitized);
  });

  test("空行使标记失效，但标记与后续正文都以可见文字保留", () => {
    const input = `${CENTER_MARKER}\n\n正文`;
    expect(findUnsupportedMarkdownFormats(input)).toEqual([
      { type: "invalid-alignment", startLine: 0, endLine: 0 },
    ]);
    const sanitized = sanitizeMilkdownMarkdown(input);
    expect(sanitized).toContain("wenyousite\\-align\\-v1\\-center");
    expect(sanitized).toContain("正文");
    expect(findUnsupportedMarkdownFormats(sanitized)).toEqual([]);
  });

  test.each([
    ["空块", "<br />", "<br />"],
    ["普通图片", "![图](https://example.com/a.png)", "![图]"],
    ["图文混排", "文字 ![图](https://example.com/a.png)", "文字"],
    ["无序列表", "- 列表项", "列表项"],
    ["有序列表", "1. 列表项", "列表项"],
    ["引用", "> 引用正文", "引用正文"],
    ["分隔线", "---", "---"],
    ["一级标题", "# 一级标题", "一级标题"],
    ["四级标题", "#### 四级标题", "四级标题"],
  ])("标记紧邻%s时不误绑定、不吞目标或后续内容", (_label, target, visible) => {
    const input = `${RIGHT_MARKER}\n${target}\n\n后续正文`;
    expect(findUnsupportedMarkdownFormats(input)).toContainEqual({
      type: "invalid-alignment",
      startLine: 0,
      endLine: 0,
    });

    const sanitized = sanitizeMilkdownMarkdown(input);
    expect(sanitized).toContain(visible);
    expect(sanitized).toContain("后续正文");
    expect(findUnsupportedMarkdownFormats(sanitized)).toEqual([]);
    expect(sanitizeMilkdownMarkdown(sanitized)).toBe(sanitized);
  });

  test("普通图片禁止对齐，但收藏表情作为行内原子允许对齐", () => {
    const image = `${CENTER_MARKER}\n文字 ![图](https://example.com/a.png)`;
    const sticker = `${CENTER_MARKER}\n![表情](https://cdn.example.com/stickers/a.webp "wenyousite-sticker:v1:asset-1")`;
    expect(findUnsupportedMarkdownFormats(image)).toContainEqual({
      type: "invalid-alignment",
      startLine: 0,
      endLine: 0,
    });
    expect(findUnsupportedMarkdownFormats(sticker)).toEqual([]);
    expect(sanitizeMilkdownMarkdown(sticker)).toBe(sticker);
  });

  test.each([
    ["引用", `> ${CENTER_MARKER}\n> 引用正文`],
    ["列表", `- ${RIGHT_MARKER}\n  列表正文`],
  ])("嵌套在%s内的源码标记只按可见文字降级", (_label, input) => {
    expect(findUnsupportedMarkdownFormats(input)).toContainEqual({
      type: "invalid-alignment",
      startLine: 0,
      endLine: 0,
    });
    const sanitized = sanitizeMilkdownMarkdown(input);
    expect(sanitized).toContain("wenyousite\\-align\\-v1");
    expect(findUnsupportedMarkdownFormats(sanitized)).toEqual([]);
    expect(sanitizeMilkdownMarkdown(sanitized)).toBe(sanitized);
  });

  test.each([
    ["style/align/data 属性", '<p style="text-align:right" align="right" data-wenyou-align="right">伪造</p>'],
    ["CSS style 块", "<style>p { text-align: center }</style>\n正文"],
    ["伪造 data 属性", '<div data-wenyou-align="center">伪造</div>'],
  ])("外部 HTML %s 不会创建对齐且只保留可见源码", (_label, input) => {
    expect(findUnsupportedMarkdownFormats(input)[0]?.type).toBe("raw-html");
    const sanitized = sanitizeMilkdownMarkdown(input);
    expect(sanitized).toContain("\\<");
    expect(sanitized).not.toContain(CENTER_MARKER);
    expect(sanitized).not.toContain(RIGHT_MARKER);
    expect(findUnsupportedMarkdownFormats(sanitized)).toEqual([]);
    expect(sanitizeMilkdownMarkdown(sanitized)).toBe(sanitized);
  });

  test("合法标记与协议外 HTML/CSS 组合最终收敛为安全字面文本", () => {
    const input = `${CENTER_MARKER}\n<span style="text-align:right">正文</span>`;
    const firstPass = sanitizeMilkdownMarkdown(input);
    const fixedPoint = sanitizeMilkdownMarkdown(firstPass);

    expect(firstPass).toContain("\\<span");
    expect(fixedPoint).toContain("wenyousite\\-align\\-v1\\-center");
    expect(fixedPoint).toContain("\\<span");
    expect(findUnsupportedMarkdownFormats(fixedPoint)).toEqual([]);
    expect(sanitizeMilkdownMarkdown(fixedPoint)).toBe(fixedPoint);
  });
});
