export type InlineColorSemantics = {
  text: string;
  color: string | null;
  bold: boolean;
  italic: boolean;
  strike: boolean;
  code: boolean;
  href: string | null;
  title: string | null;
};
export type ColorBlockSemantics = {
  tag: "p" | "h2" | "h3";
  align: "left" | "center" | "right";
  content: InlineColorSemantics[];
};
export type ColorAlignmentCase = {
  id: string;
  source: string;
  expected: ColorBlockSemantics[];
  wholeBlockColor?: boolean;
};

export const rgb = "#D14343";
export const colored = (text: string) => '<span data-wenyou-color-v1="' + rgb + '">' + text + "</span>";
export const inline = (text: string, props: Partial<InlineColorSemantics> = {}): InlineColorSemantics => ({
  text, color: rgb, bold: false, italic: false, strike: false, code: false,
  href: null, title: null, ...props,
});
const text = "如何呢😀a\u0301";
const href = "https://example.com/path";
const variants = [
  { id: "plain", source: text, content: [inline(text)] },
  { id: "bold", source: "**" + text + "**", content: [inline(text, { bold: true })] },
  { id: "italic", source: "*" + text + "*", content: [inline(text, { italic: true })] },
  { id: "strike", source: "~~" + text + "~~", content: [inline(text, { strike: true })] },
  { id: "link", source: "[" + text + "](" + href + ")", content: [inline(text, { href })] },
  { id: "code", source: "`" + text + "`", content: [inline(text, { code: true })] },
  { id: "bold-italic", source: "***" + text + "***", content: [inline(text, { bold: true, italic: true })] },
  {
    id: "all-separated",
    source: "**" + text + "** *斜体* ~~删除~~ [链接](" + href + ") `代码`",
    content: [
      inline(text, { bold: true }), inline(" "), inline("斜体", { italic: true }),
      inline(" "), inline("删除", { strike: true }), inline(" "), inline("链接", { href }),
      inline(" "), inline("代码", { code: true }),
    ],
  },
];
const alignments = ["left", "center", "right"] as const;
const tags = ["p", "h2", "h3"] as const;
const marker = (align: string) => align === "left" ? "" : "[wenyousite-align-v1-" + align + "]: #\n";

// 预期语义直接声明，不从待验证的 Markdown parser/serializer 生成。
export const colorAlignmentCases: ColorAlignmentCase[] = [
  {
    id: "reported-exact-center-p",
    source: marker("center") + colored("如何呢"),
    expected: [{ tag: "p", align: "center", content: [inline("如何呢")] }],
    wholeBlockColor: true,
  },
  ...alignments.flatMap((align) => tags.flatMap((tag) => variants.map((variant) => ({
    id: align + "-" + tag + "-" + variant.id,
    source: marker(align) + (tag === "h2" ? "## " : tag === "h3" ? "### " : "") + colored(variant.source),
    expected: [{ tag, align, content: variant.content }],
    wholeBlockColor: true,
  })))),
  {
    id: "center-soft-line",
    source: marker("center") + colored("首行") + "\n" + colored("次行"),
    expected: [{ tag: "p", align: "center", content: [inline("首行"), inline("\n", { color: null }), inline("次行")] }],
  },
  {
    id: "mixed-blocks",
    source: marker("center") + colored("中") + "\n\n" + marker("right") + "## " + colored("右") + "\n\n### " + colored("左") + "\n\n尾段",
    expected: [
      { tag: "p", align: "center", content: [inline("中")] },
      { tag: "h2", align: "right", content: [inline("右")] },
      { tag: "h3", align: "left", content: [inline("左")] },
      { tag: "p", align: "left", content: [inline("尾段", { color: null })] },
    ],
  },
  {
    id: "center-color-edge-spaces",
    source: marker("center") + colored(" 居中 ") + "尾部",
    expected: [{ tag: "p", align: "center", content: [inline(" 居中 "), inline("尾部", { color: null })] }],
  },
  ...(["center", "right"] as const).map((align) => ({
    id: align + "-adjacent-without-blank",
    source: "前段\n" + marker(align) + colored("如何呢"),
    expected: [
      { tag: "p" as const, align: "left" as const, content: [inline("前段", { color: null })] },
      { tag: "p" as const, align, content: [inline("如何呢")] },
    ],
  })),
];
