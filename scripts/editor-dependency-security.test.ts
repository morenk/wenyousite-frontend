import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { expect, test, vi } from "vitest";

// 从真实消费链解析，避免测试意外命中另一份已修复的并列安装。
const localRequire = createRequire(import.meta.url);
const crepeRequire = createRequire(localRequire.resolve("@milkdown/crepe"));
const vueRequire = createRequire(crepeRequire.resolve("vue"));
const compilerRequire = createRequire(vueRequire.resolve("@vue/compiler-sfc"));
const katex = crepeRequire("katex") as {
  renderToString: (source: string, options?: Record<string, unknown>) => string;
};

test("Vue SSR 丢弃包含回车的属性名，同时保留普通属性", () => {
  const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
  const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
  try {
    const renderer = vueRequire("@vue/server-renderer") as {
      ssrRenderAttrs: (props: Record<string, string>) => string;
    };
    const html = renderer.ssrRenderAttrs({ title: "正常资料", "x\rautofocus\ronfocus": "unsafe()" });
    expect(html).toContain('title="正常资料"');
    expect(html).not.toContain("onfocus");
    expect(html).not.toContain("autofocus");
    expect(html).not.toContain("\r");
  } finally {
    warn.mockRestore(); error.mockRestore();
  }
});

test("KaTeX 不继承原型上的 trust，常用公式与配套 CSS 仍能渲染", () => {
  const inherited = Object.create({ trust: true }) as Record<string, unknown>;
  inherited.throwOnError = false;
  const untrusted = katex.renderToString(String.raw`\href{javascript:unsafe()}{x}`, inherited);
  expect(untrusted).not.toContain("<a ");
  expect(untrusted).not.toContain('href="javascript:');
  const formula = katex.renderToString(String.raw`\frac{a^2+b^2}{c}`, { displayMode: true });
  expect(formula).toContain("katex-display");
  expect(formula).toContain("<math");
  expect(formula).toContain("katex-base");
  const css = readFileSync(crepeRequire.resolve("katex/dist/katex.min.css"), "utf8");
  expect(css).toContain(".katex-base");
});

test("SourceMap 在解析阶段拒绝过大的 section 行偏移", () => {
  const { SourceMapConsumer } = compilerRequire("source-map-js") as {
    SourceMapConsumer: new (map: object) => { originalPositionFor: (position: object) => object };
  };
  const section = (line: number) => ({ version: 3, sections: [{ offset: { line, column: 0 },
    map: { version: 3, sources: ["test.js"], names: [], mappings: "AAAA" } }] });
  expect(() => new SourceMapConsumer(section(100_000_000))).toThrow(/offset/i);
  const valid = new SourceMapConsumer({ version: 3, sources: ["test.js"], names: [], mappings: "AAAA" });
  expect(valid.originalPositionFor({ line: 1, column: 0 })).toMatchObject({ source: "test.js", line: 1, column: 0 });
});
