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
  test("仅固定生成姓名数据中的 Noto 获得识别，片段外字体声明仍拒绝", () => {
    const canonical = readFileSync("src/lib/tools/name-data/it.json", "utf8").trimEnd();
    const sourceName = "/src/lib/tools/name-data/it.json";
    expect(fontViolations(sourceName, canonical)).toEqual([]);
    const emitted = `i.exports=JSON.parse(${JSON.stringify(canonical)})`;
    expect(fontViolations("chunk.js", emitted)).toEqual([]);
    expect(fontViolations("chunk.js", `i.exports=JSON.parse('${canonical.replaceAll("'", "\\'")}')`)).toEqual([]);
    expect(fontViolations("random.json", canonical)).not.toEqual([]);
    expect(fontViolations(sourceName, canonical.replace('"source":', '"extra":"Noto","source":'))).not.toEqual([]);
    expect(fontViolations("chunk.js", 'const names = ["Noto", "Rossi"]')).not.toEqual([]);
    for (const content of ["font-family: 'Noto'", 'fontFamily: "Noto"', 'font-family: ui-sans-serif, "Noto"', 'font-family: Noto Sans', 'font-family: Noto Serif', 'font-family: Noto Color Emoji', 'src:url(/fonts/Noto.woff2)', 'const style = { "fontFamily": "Noto" };', '{"font-family":"Noto"}', 'body { font: 16px "Noto"; }', 'body { font-family:\n"Noto"; }', '--app-font:"Noto";font-family:var(--app-font)', 'const family="Noto";const style={fontFamily:family}']) {
      expect(fontViolations("chunk.css", content)).not.toEqual([]);
      expect(fontViolations("chunk.js", emitted + ";" + content)).not.toEqual([]);
    }
    expect(fontViolations("Noto.woff2")).not.toEqual([]);
  });
  test("完整固定正文目录可携带协议 ID，片段或 UI 字体声明仍拒绝", () => {
    const catalog = JSON.parse(readFileSync("contracts/thread-font-catalog-v1.json", "utf8"));
    const compiled = `module.exports=JSON.parse(${JSON.stringify(JSON.stringify(catalog))})`;
    expect(fontViolations("chunk.js", compiled)).toEqual([]);
    const object = JSON.stringify(catalog).replace(/"([a-zA-Z]+)":/gu, "$1:");
    expect(fontViolations("chunk.js", "module.exports=" + object)).toEqual([]);
    expect(fontViolations("chunk.js", "module.exports=" + object + ';const ui={fontFamily:"wenkai"}')).not.toEqual([]);
    const map = { sources: ["../../contracts/thread-font-catalog-v1.json"], sourcesContent: [JSON.stringify(catalog)] };
    expect(fontViolations("chunk.js.map", JSON.stringify(map))).toEqual([]);
    expect(fontViolations("chunk.js.map", JSON.stringify({ ...map, sourcesContent: [JSON.stringify(catalog) + 'fontFamily="wenkai"'] }))).not.toEqual([]);
    expect(fontViolations("chunk.js.map", JSON.stringify({ ...map, sources: ["random.json"] }))).not.toEqual([]);

    expect(fontViolations("chunk.js", compiled + ';const ui={fontFamily:"wenkai"}')).not.toEqual([]);
    expect(fontViolations("chunk.js", `JSON.parse('{"id":"wenkai"}')`)).not.toEqual([]);
    expect(fontViolations("chunk.css", 'body{font-family:wenkai}')).not.toEqual([]);
  });
  test("保留数学、图标字体与系统等宽栈", () => {
    for (const name of ["KaTeX_Main-Regular.abc123.woff2", "MaterialIcons-Regular.abc123.woff2"]) {
      expect(fontViolations(name)).toEqual([]);
      expect(fontViolations("chunk.css", `src:url(/assets/${name})`)).toEqual([]);
    }
    expect(fontViolations("chunk.css", 'font-family: ui-monospace, Consolas, monospace')).toEqual([]);
  });
});

test("字体上传accept不视为下载，邻近src和普通字符串仍检查",()=>{
 expect(fontViolations("upload.tsx",'<input type="file" accept=".ttf,.otf" />')).toEqual([]);
 expect(fontViolations("chunk.js",'jsx(Input,{accept:".ttf,.otf"})')).toEqual([]);
 expect(fontViolations("upload.tsx",'<input accept=".ttf,.otf" src="bad.ttf" />')).not.toEqual([]);
 expect(fontViolations("chunk.js",'fetch(".ttf,.otf")')).not.toEqual([]);
});


test("固定历史导入映射按完整契约识别，错映射和邻近UI字体仍拒绝", () => {
 const mapping = JSON.parse(readFileSync("contracts/thread-font-v1-import-map.json", "utf8"));
 const compiled = "module.exports=" + JSON.stringify(mapping).replace(/"([a-zA-Z]+)":/gu, "$1:");
 expect(fontViolations("chunk.js", compiled)).toEqual([]);
 expect(fontViolations("chunk.js", compiled.replace("preserveAssetFamily:true", "preserveAssetFamily:!0"))).toEqual([]);
 expect(fontViolations("chunk.js", compiled + ';const style={fontFamily:"wenkai"}')).not.toEqual([]);
 const changed = structuredClone(mapping); changed.fonts[0].versionId = "tfv_" + "0".repeat(32);
 expect(fontViolations("chunk.js", "module.exports=" + JSON.stringify(changed))).not.toEqual([]);
 expect(fontViolations("chunk.js", 'const id="wenkai"')).not.toEqual([]);
 const map = { sources: ["../../contracts/thread-font-v1-import-map.json"], sourcesContent: [JSON.stringify(mapping)] };
 expect(fontViolations("chunk.js.map", JSON.stringify(map))).toEqual([]);
 expect(fontViolations("chunk.js.map", JSON.stringify({ ...map, sources: ["random.json"] }))).not.toEqual([]);
 expect(fontViolations("chunk.js.map", JSON.stringify({ ...map, sourcesContent: [JSON.stringify(changed)] }))).not.toEqual([]);
});

test("source map 中上传accept精确识别，普通字符串和下载地址仍拒绝", () => {
 const map = (source: string) => JSON.stringify({ sources: ["upload.tsx"], sourcesContent: [source] });
 expect(fontViolations("chunk.js.map", map('<input accept=".ttf,.otf" />'))).toEqual([]);
 expect(fontViolations("chunk.js.map", map('<input accept=".ttf,.otf" src="bad.ttf" />'))).not.toEqual([]);
 expect(fontViolations("chunk.js.map", map('fetch(".ttf,.otf")'))).not.toEqual([]);
});
