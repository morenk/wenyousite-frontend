import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";
import { fontViolations } from "./check-system-fonts.mjs";

describe("系统字体回归门禁", () => {
  test.each(["Noto Sans SC", "LXGW WenKai", "Nunito", "@wenyousite/foundation/web/fonts.css"])("拒绝旧入口 %s", (value) => {
    expect(fontViolations("chunk.js", `import "${value}"`)).not.toEqual([]);
  });
  test.each(["brand.woff2", "opaque-hash.ttf", "rounded.otf", "custom.eot"])("拒绝改名后的自有字体 %s", (name) => {
    expect(fontViolations(name)).not.toEqual([]);
    expect(fontViolations("chunk.css", `src:url(/assets/${name}?v=1)`)).not.toEqual([]);
    expect(fontViolations("layout.tsx", `href="https://cdn.test/${name}"`)).not.toEqual([]);
  });
  test("拒绝内嵌和本机专有字形的 @font-face", () => {
    expect(fontViolations("chunk.css", '@font-face{font-family:brand;src:url(data:font/woff2;base64,AA)}')).not.toEqual([]);
    expect(fontViolations("chunk.css", '@font-face{font-family:brand;src:local("Custom Font")}')).not.toEqual([]);
  });
  test("框架度量表不携带禁用家族，保留默认度量能力", async () => {
    const metrics = JSON.parse(readFileSync("node_modules/next/dist/server/capsize-font-metrics.json", "utf8"));
    expect(Object.keys(metrics)).toHaveLength(1541);
    expect(metrics.monoton).toBeDefined();
    expect(fontViolations("capsize-font-metrics.json", JSON.stringify(metrics))).toEqual([]);
    const { calculateSizeAdjustValues } = await import("next/dist/server/font-utils");
    expect(calculateSizeAdjustValues("Arial")).toMatchObject({ fallbackFont: "Arial", sizeAdjust: "100.00" });
  });
  test("Zod 乌兹别克语错误文案不是字体家族", () => {
    expect(fontViolations("chunk.js", "Noto‘g‘ri kirish")).toEqual([]);
    expect(fontViolations("chunk.css", "font-family: Noto Sans, Noto Color Emoji")).not.toEqual([]);
  });
  test("保留数学、图标字体与系统等宽栈", () => {
    for (const name of ["KaTeX_Main-Regular.abc123.woff2", "MaterialIcons-Regular.abc123.woff2"]) {
      expect(fontViolations(name)).toEqual([]);
      expect(fontViolations("chunk.css", `src:url(/assets/${name})`)).toEqual([]);
    }
    expect(fontViolations("chunk.css", 'font-family: ui-monospace, Consolas, monospace')).toEqual([]);
  });
});
