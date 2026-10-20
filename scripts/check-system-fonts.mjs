/** 系统字体门禁：界面不得重新引入自有字体；正文仅消费固定目录与校验加载器。 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { resolve, relative, basename } from "node:path";
import { pathToFileURL } from "node:url";
import ts from "typescript";

export const retiredFontPattern = /\bnoto(?=[\s"'_,.-]|$)|lxgw|wenkai|nunito|fonts\.css/i;
export const fontExtensionPattern = /\.(?:woff2?|ttf|otf|eot)(?:[?#]|$)/i;
// 数学/图标字体是功能资源；不将它们误判为界面字体。哈希文件名仍保留家族前缀。
export const functionalFontPattern = /^(?:KaTeX_[\w-]+|Material(?:Icons|Symbols)[\w-]*)(?:\.[\w-]+)?\.(?:woff2?|ttf|otf|eot)$/i;

/** 只识别固定来源的完整姓名数据，不豁免目录、文件或任意字符串。 */
function maskNameHomonym(name, content) {
  if (!content.includes("Noto") || !content.includes("@faker-js/faker@10.6.0/it")) return content;
  const canonical = readFileSync(resolve("src/lib/tools/name-data/it.json"), "utf8").trimEnd();
  const data = JSON.parse(canonical);
  if (Object.keys(data).sort().join(",") !== "family,given,source" || data.source !== "@faker-js/faker@10.6.0/it") return content;
  for (const group of [data.given, data.family]) {
    if (!group || typeof group !== "object" || Array.isArray(group) || !Object.keys(group).length) return content;
    for (const [key, names] of Object.entries(group)) {
      if (!["female", "male", "generic"].includes(key) || !Array.isArray(names) || !names.length || names.some((value) => typeof value !== "string")) return content;
    }
  }
  for (const group of [data.given, data.family]) {
    for (const key of Object.keys(group)) group[key] = group[key].map((value) => value === "Noto" ? "[姓名]" : value);
  }
  const masked = JSON.stringify(data);
  if (/[\\/]src[\\/]lib[\\/]tools[\\/]name-data[\\/]it\.json$/.test(name)) {
    return content.trimEnd() === canonical ? masked : content;
  }
  if (!/\.[cm]?[jt]sx?$/.test(name)) return content;
  // Next 会将 JSON 编译为 JSON.parse 字面量；parser 只解析，不执行构建内容。
  const source = ts.createSourceFile(name, content, ts.ScriptTarget.Latest, true);
  const spans = [];
  function visit(node) {
    if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression) &&
      node.expression.expression.getText(source) === "JSON" && node.expression.name.text === "parse" &&
      node.arguments.length === 1 && ts.isStringLiteral(node.arguments[0]) && node.arguments[0].text === canonical) {
      spans.push([node.arguments[0].getStart(source), node.arguments[0].end]);
    }
    ts.forEachChild(node, visit);
  }
  visit(source);
  let result = content;
  for (const [start, end] of spans.reverse()) result = result.slice(0, start) + JSON.stringify(masked) + result.slice(end);
  return result;
}

/** 固定正文目录中的协议 ID 不是 UI 字体声明；仅识别完整、逐字段一致的 JSON。 */
function maskContentFontCatalog(name, content) {
  if (!content.includes("wenkai")) return content;
  const canonical = JSON.stringify(JSON.parse(readFileSync(resolve("contracts/thread-font-catalog-v1.json"), "utf8")));
  const same = (value) => JSON.stringify(value) === canonical;
  if (name.endsWith(".map")) {
    try {
      const map = JSON.parse(content);
      if (Array.isArray(map.sources) && Array.isArray(map.sourcesContent)) {
        map.sourcesContent = map.sourcesContent.map((source, index) => {
          if (typeof source !== "string" || !/\/contracts\/thread-font-catalog-v1\.json(?:[.?]|$)/u.test(map.sources[index] ?? "")) return source;
          try { return same(JSON.parse(source)) ? "[受控正文目录]" : source; } catch { return source; }
        });
        return JSON.stringify(map);
      }
    } catch { /* 非法 source map 不获得豁免。 */ }
    return content;
  }
  if (!/\.[cm]?[jt]sx?$/.test(name)) return content;
  const source = ts.createSourceFile(name, content, ts.ScriptTarget.Latest, true);
  const spans = [];
  // 只读取无计算、无展开的 JSON 字面量，不执行构建代码。
  function literal(node) {
    if (ts.isStringLiteral(node)) return node.text;
    if (ts.isNumericLiteral(node)) return Number(node.text);
    if (ts.isArrayLiteralExpression(node)) return node.elements.map(literal);
    if (ts.isObjectLiteralExpression(node)) return Object.fromEntries(node.properties.map((property) => {
      if (!ts.isPropertyAssignment(property) || !(ts.isIdentifier(property.name) || ts.isStringLiteral(property.name))) throw new Error("不是 JSON 属性");
      return [property.name.text, literal(property.initializer)];
    }));
    throw new Error("不是 JSON 字面量");
  }
  function visit(node) {
    if (ts.isObjectLiteralExpression(node)) {
      try { if (same(literal(node))) { spans.push([node.getStart(source), node.end]); return; } } catch { /* 非目录对象继续递归检查。 */ }
    }
    if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression) &&
      node.expression.expression.getText(source) === "JSON" && node.expression.name.text === "parse" &&
      node.arguments.length === 1 && ts.isStringLiteral(node.arguments[0])) {
      try {
        if (same(JSON.parse(node.arguments[0].text))) spans.push([node.arguments[0].getStart(source), node.arguments[0].end]);
      } catch { /* 非目录 JSON 继续按旧字体门禁检查。 */ }
    }
    ts.forEachChild(node, visit);
  }
  visit(source);
  for (const [start, end] of spans.reverse()) content = content.slice(0, start) + '"[受控正文目录]"' + content.slice(end);
  return content;
}

export function fontViolations(name, content = "") {
  const failures = [];
  content = maskContentFontCatalog(name, maskNameHomonym(name, content));
  if (retiredFontPattern.test(name) || retiredFontPattern.test(content)) failures.push("旧字体名称或 fonts.css 入口");
  if (fontExtensionPattern.test(name) && !functionalFontPattern.test(basename(name))) failures.push("自有字体文件");
  for (const match of content.matchAll(/(?:url\(\s*["']?|["'])([^\s"'()<>]+\.(?:woff2?|ttf|otf|eot)(?:[?#][^\s"'()<>]*)?)/gi)) {
    if (!functionalFontPattern.test(basename(match[1].split(/[?#]/)[0]))) failures.push(`自有字体请求 ${match[1]}`);
  }
  for (const [rule] of content.matchAll(/@font-face\s*\{[^}]*\}/gi)) {
    if (!/font-family\s*:\s*["']?(?:KaTeX_|Material(?:Icons|Symbols))/i.test(rule)) failures.push("自有 @font-face");
  }
  return failures;
}

export function scanSystemFonts(root, directories) {
  const failures = [];
  let files = 0;
  function walk(directory) {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const file = resolve(directory, entry.name);
      if (entry.isDirectory()) {
        if (entry.name !== "__tests__") walk(file);
      } else if (entry.isFile() && !/\.(test|spec)\.[cm]?[jt]sx?$/.test(entry.name)) {
        files++;
        const content = /\.(?:[cm]?[jt]sx?|css|html|json|map|svg|webmanifest)$/.test(entry.name) ? readFileSync(file, "utf8") : "";
        for (const violation of fontViolations(file, content)) failures.push(`${relative(root, file)}: ${violation}`);
      }
    }
  }
  for (const directory of directories) {
    const target = resolve(root, directory);
    if (!statSync(target, { throwIfNoEntry: false })?.isDirectory()) throw new Error(`字体扫描目录不存在：${directory}`);
    walk(target);
  }
  return { files, failures };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const build = process.argv.includes("--build");
  const directories = build
    ? [".next/static", ".next/server", ".next/standalone", "public"]
    : ["src", "public"];
  const result = scanSystemFonts(process.cwd(), directories);
  if (!build) {
    for (const name of ["package.json", "pnpm-lock.yaml"]) {
      for (const violation of fontViolations(name, readFileSync(name, "utf8").replace(/integrity: sha\d+-[A-Za-z0-9+/=]+/g, ""))) result.failures.push(`${name}: ${violation}`);
    }
  }
  if (result.failures.length) throw new Error(`系统字体检查失败：\n${result.failures.join("\n")}`);
  console.log(`系统字体检查通过：${directories.join("、")}，${result.files} 个文件，无旧界面字体、打包字体资产或失效入口`);
}
